# BotScore: Ubuntu VPS Operations

Last verified: 2026-07-14

## Decision

Use one Ubuntu VPS first. The application no longer needs Cloud Run, Cloud Tasks, Redis, Kubernetes, or a separate managed queue for the initial production stage.

```text
Internet
  -> optional Cloudflare DNS/proxy
  -> Caddy :80/:443
       -> Next.js web/API :3000
            -> PostgreSQL
            -> pg-boss queue in PostgreSQL
       -> audit worker
            -> Chromium (bounded concurrency)
            -> PostgreSQL
```

The product UI, scanner, rules, result URLs, and lead flow are unchanged. The infrastructure boundary changed from embedded PGlite plus an in-memory queue to PostgreSQL plus pg-boss and a separate Worker process.

## Why this is the right first stack

- One VPS, one repository, one `docker compose` command, and one database backup format.
- PostgreSQL is both the product database and durable queue store; no Redis or cloud task service is required.
- Web traffic cannot accidentally create unlimited Chromium processes. `AUDIT_CONCURRENCY` is a hard per-Worker cap.
- A Web or Worker restart does not lose queued jobs. pg-boss retries failed/expired jobs with backoff.
- Caddy manages HTTPS and reverse proxying. PostgreSQL and application ports are not exposed publicly.
- The same images run on x86_64 or ARM64 Ubuntu hosts.

## VPS starting size

Start with 2–4 vCPU, 4 GB RAM, and at least 40 GB SSD. Keep `AUDIT_CONCURRENCY=2` on a 4 GB host. Chromium is the dominant RAM/CPU consumer; raising concurrency without measuring memory can make the entire VPS less reliable.

Add a 2 GB swap file as a crash cushion, not as normal browser capacity. Keep at least 20% disk free for PostgreSQL, image upgrades, and backups.

## First deployment

Prerequisites: Ubuntu, Docker Engine with the Compose plugin, a non-root deploy user in the `docker` group, and DNS pointing at the VPS.

```bash
git clone https://github.com/tentenco/BotScore.git
cd BotScore
cp .env.production.example .env
```

Generate two different secrets and edit `.env`:

```bash
openssl rand -base64 36 | tr -d '/+=' | head -c 48
openssl rand -base64 36 | tr -d '/+=' | head -c 48
```

Set the first as `POSTGRES_PASSWORD`, the second as `RATE_LIMIT_SALT`, and set `APP_DOMAIN` to the real hostname. Use URL-safe characters in the database password because it is embedded in `DATABASE_URL`.

Allow inbound TCP 22, 80, and 443 plus UDP 443. Do not expose 3000 or 5432 in the VPS firewall or Compose file.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail https://your-domain.example/api/health/live
curl --fail https://your-domain.example/api/health/ready
```

`/api/health/live` proves the Web process is responding. `/api/health/ready` also checks PostgreSQL and requires a Worker heartbeat from the last 90 seconds.

## Service responsibilities

| Service | Responsibility | Public port |
| --- | --- | --- |
| `caddy` | TLS, HTTP/2/3, compression, trusted proxy boundary | 80, 443 |
| `web` | Next.js pages and APIs; enqueue only | none |
| `worker` | Bounded audit execution and Chromium | none |
| `postgres` | Audits, leads, tokens, rate events, pg-boss jobs | none |
| `migrate` | One-shot ordered SQL migrations before Web/Worker start | none |

## Capacity model

Readers and scans are different workloads. Cached/static page reads are cheap; a scan performs multiple network requests and launches Chromium.

```text
audits per minute ~= worker concurrency × 60 / p95 audit seconds
```

With concurrency 2 and a measured p95 of 20 seconds, one VPS drains about six audits per minute. A burst of 100 jobs takes roughly 17 minutes; 1,000 takes roughly 2.8 hours. The API can accept the burst quickly, but the queue intentionally protects the server and target websites.

The local container integration check on 2026-07-14 completed an `example.com` rendered audit in about 1.7 seconds. That is functional proof, not a capacity promise; production sizing must use p95 from varied real targets.

Cost controls already implemented:

- same-host active-job deduplication;
- six-hour completed-result reuse keyed by hostname and rule version;
- bounded Worker concurrency;
- two retries with exponential backoff;
- atomic per-identity request quota;
- adaptive client polling with jitter and background-tab slowdown;
- automatic report-token, rate-event, and audit-retention cleanup.

## Backups and restore

Create a compressed logical backup:

```bash
./scripts/backup-postgres.sh
```

The script keeps 14 days locally. Schedule it daily with the deploy user's cron:

```cron
17 3 * * * cd /opt/search-inspector && ./scripts/backup-postgres.sh >> /var/log/search-inspector-backup.log 2>&1
```

Local backups do not protect against VPS loss. Copy encrypted backups to a second provider or object store. Test restoration before launch.

Restore into an empty database during a maintenance window:

```bash
docker compose stop web worker
gunzip -c backups/inspector-YYYYMMDDTHHMMSSZ.sql.gz \
  | docker compose exec -T postgres psql --username inspector --dbname inspector
docker compose up -d web worker caddy
```

## Upgrade and rollback discipline

Before each upgrade:

```bash
./scripts/backup-postgres.sh
docker compose config --quiet
docker compose up -d --build --remove-orphans
docker compose ps
curl --fail https://your-domain.example/api/health/ready
```

Migrations are append-only SQL files under `migrations/` and execute once, under a PostgreSQL advisory lock. Do not edit an already-applied migration; add a new numbered file.

Application rollback is an image/source rollback. Database rollback must be designed per migration; keep a verified pre-deploy backup for destructive schema changes.

## Monitoring and incident checks

Useful first commands:

```bash
docker compose ps
docker compose logs --tail=200 web worker postgres caddy
docker stats --no-stream
df -h
free -h
```

Alert when readiness fails, disk usage exceeds 80%, memory repeatedly swaps, the Worker restarts, or the oldest queued job exceeds the acceptable wait time. Before opening public traffic, add an external uptime check for `/api/health/ready`.

## Safe growth path

1. Measure queue age, p50/p95 scan duration, completion rate, and peak Worker memory.
2. Move from 4 GB to 8 GB and raise concurrency cautiously if CPU/RAM, not network latency, is the bottleneck.
3. Add a second Worker only when PostgreSQL is reachable through a private network and both hosts share the same queue database.
4. Move PostgreSQL to a managed service before running Workers across disposable hosts.
5. Only move to Cloud Run/Cloud Tasks or Kubernetes when traffic and operational needs justify the extra services.

Serving 100 or 1,000 simultaneous readers does not require 100 or 1,000 Workers. For bursty public launches, keep accepting jobs, expose queue wait information, and scale the Worker pool from measured demand.

## Remaining launch hardening

- Add Turnstile or another proof-of-human check before a large public campaign.
- Add a global daily scan budget/kill switch and per-domain quota.
- Run a 24-hour soak test with forced Worker restarts.
- Load-test the API and queue with controlled local targets; never load-test unrelated websites.
- Perform a backup restore drill and verify expired-data cleanup.
- Keep SSRF, redirect, DNS rebinding, browser subresource, and decompression-limit tests green.
