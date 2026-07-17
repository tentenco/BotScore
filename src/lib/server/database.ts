import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import type { AuditRecord, AuditResult, AuditStatus } from "@/lib/audit/types";
import { canonicalHostname } from "@/lib/audit/result-url";
import { RULE_VERSION } from "@/lib/audit/sources";

interface AuditRow {
  id: string;
  url: string;
  hostname: string;
  status: AuditStatus;
  stage: string;
  progress: number;
  result: AuditResult | string | null;
  error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ReportRow {
  audit_id: string;
  email: string;
  expires_at: string | Date;
}

declare global {
  var __botScorePool: Pool | undefined;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required");
  return value;
}

export function getDatabase() {
  globalThis.__botScorePool ??= new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });
  return globalThis.__botScorePool;
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseResult(value: AuditRow["result"]) {
  if (!value) return null;
  return typeof value === "string" ? (JSON.parse(value) as AuditResult) : value;
}

function mapAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    url: row.url,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    result: parseResult(row.result),
    error: row.error,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findReusableAuditWithClient(client: PoolClient, hostname: string) {
  const cacheSeconds = Math.max(0, Number(process.env.AUDIT_CACHE_TTL_SECONDS ?? 21_600));
  const result = await client.query<AuditRow>(
    `SELECT * FROM audit_runs
     WHERE hostname = $1
       AND (
         status IN ('queued', 'running')
         OR (
           status = 'completed'
           AND updated_at > CURRENT_TIMESTAMP - ($2 * INTERVAL '1 second')
           AND result->>'ruleVersion' = $3
         )
       )
     ORDER BY CASE WHEN status IN ('queued', 'running') THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [hostname, cacheSeconds, RULE_VERSION],
  );
  return result.rows[0] ? mapAudit(result.rows[0]) : null;
}

export async function createOrReuseAudit(url: string) {
  const hostname = canonicalHostname(new URL(url).hostname);
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`audit:${hostname}`]);
    const reusable = await findReusableAuditWithClient(client, hostname);
    if (reusable) return { audit: reusable, reused: true } as const;

    const result = await client.query<AuditRow>(
      `INSERT INTO audit_runs (id, url, hostname, status, stage, progress)
       VALUES ($1, $2, $3, 'queued', '等待掃描資源', 2)
       RETURNING *`,
      [randomUUID(), url, hostname],
    );
    return { audit: mapAudit(result.rows[0]), reused: false } as const;
  });
}

export async function getAudit(id: string) {
  const result = await getDatabase().query<AuditRow>("SELECT * FROM audit_runs WHERE id = $1", [id]);
  return result.rows[0] ? mapAudit(result.rows[0]) : null;
}

export async function getLatestAuditByHostname(hostname: string) {
  const normalized = canonicalHostname(hostname);
  const result = await getDatabase().query<AuditRow>(
    "SELECT * FROM audit_runs WHERE hostname = $1 ORDER BY created_at DESC LIMIT 1",
    [normalized],
  );
  return result.rows[0] ? mapAudit(result.rows[0]) : null;
}

export async function startAuditAttempt(id: string) {
  const result = await getDatabase().query<AuditRow>(
    `UPDATE audit_runs
     SET status = 'running', stage = '正在啟動掃描', progress = GREATEST(progress, 4),
         attempt_count = attempt_count + 1, started_at = CURRENT_TIMESTAMP,
         error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status <> 'completed'
     RETURNING *`,
    [id],
  );
  return result.rows[0] ? mapAudit(result.rows[0]) : null;
}

export async function updateAuditProgress(id: string, progress: number, stage: string) {
  await getDatabase().query(
    `UPDATE audit_runs
     SET status = 'running', progress = $2, stage = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status <> 'completed'`,
    [id, progress, stage],
  );
}

export async function completeAudit(id: string, result: AuditResult) {
  await getDatabase().query(
    `UPDATE audit_runs
     SET status = 'completed', progress = 100, stage = '診斷完成', result = $2::jsonb,
         error = NULL, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, JSON.stringify(result)],
  );
}

export async function retryAudit(id: string, error: string) {
  await getDatabase().query(
    `UPDATE audit_runs
     SET status = 'queued', stage = '暫時失敗，準備自動重試', error = $2,
         progress = LEAST(progress, 90), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status <> 'completed'`,
    [id, error.slice(0, 500)],
  );
}

export async function failAudit(id: string, error: string) {
  await getDatabase().query(
    `UPDATE audit_runs
     SET status = 'failed', stage = '無法完成診斷', error = $2,
         finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status <> 'completed'`,
    [id, error.slice(0, 500)],
  );
}

export interface LeadInput {
  auditId: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  marketingConsent: boolean;
}

export async function saveLead(input: LeadInput) {
  const email = input.email.trim().toLowerCase();
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO leads (id, audit_id, email, name, company, role, marketing_consent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (audit_id, email) DO UPDATE SET
         name = EXCLUDED.name,
         company = EXCLUDED.company,
         role = EXCLUDED.role,
         marketing_consent = EXCLUDED.marketing_consent,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        randomUUID(), input.auditId, email, input.name || null, input.company || null,
        input.role || null, input.marketingConsent,
      ],
    );
    const leadId = result.rows[0].id;
    await client.query(
      `INSERT INTO consent_events (id, lead_id, consent_type, granted, notice_version)
       VALUES ($1, $2, 'marketing_email', $3, '2026-07-14-v1')`,
      [randomUUID(), leadId, input.marketingConsent],
    );
    return { id: leadId, email };
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createReportAccess(auditId: string, email: string) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await getDatabase().query(
    `INSERT INTO report_access (token_hash, audit_id, email, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [hashToken(token), auditId, email, expiresAt.toISOString()],
  );
  return { token, expiresAt };
}

export async function getReportByToken(token: string) {
  const result = await getDatabase().query<ReportRow>(
    `SELECT audit_id, email, expires_at FROM report_access
     WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [hashToken(token)],
  );
  const access = result.rows[0];
  if (!access) return null;
  const audit = await getAudit(access.audit_id);
  return audit?.status === "completed" && audit.result
    ? { audit, email: access.email, expiresAt: toIso(access.expires_at) }
    : null;
}

export async function consumeRateLimit(
  identifier: string,
  endpoint: string,
  limit: number,
  windowSeconds: number,
) {
  const salt = process.env.RATE_LIMIT_SALT ?? "botscore-local";
  const keyHash = createHash("sha256").update(`${salt}:${identifier}`).digest("hex");
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${keyHash}:${endpoint}`]);
    const count = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM request_events
       WHERE key_hash = $1 AND endpoint = $2
         AND created_at > CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second')`,
      [keyHash, endpoint, windowSeconds],
    );
    if (Number(count.rows[0]?.count ?? 0) >= limit) return false;
    await client.query(
      "INSERT INTO request_events (id, key_hash, endpoint) VALUES ($1, $2, $3)",
      [randomUUID(), keyHash, endpoint],
    );
    return true;
  });
}

export async function heartbeat(service: string, instanceId: string, metadata: object = {}) {
  await getDatabase().query(
    `INSERT INTO service_heartbeats (service, instance_id, metadata)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (service) DO UPDATE SET instance_id = EXCLUDED.instance_id,
       metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
    [service, instanceId, JSON.stringify(metadata)],
  );
}

export async function getWorkerHealth() {
  const result = await getDatabase().query<{ updated_at: Date }>(
    "SELECT updated_at FROM service_heartbeats WHERE service = 'audit-worker'",
  );
  const lastSeen = result.rows[0]?.updated_at;
  return {
    healthy: Boolean(lastSeen && Date.now() - lastSeen.getTime() < 90_000),
    lastSeen: lastSeen?.toISOString() ?? null,
  };
}

export async function checkDatabase() {
  await getDatabase().query("SELECT 1");
}

export async function listQueuedAudits(limit = 1_000) {
  const result = await getDatabase().query<AuditRow>(
    `SELECT * FROM audit_runs
     WHERE status = 'queued'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapAudit);
}

export async function cleanupExpiredData() {
  await getDatabase().query("DELETE FROM request_events WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'");
  await getDatabase().query("DELETE FROM report_access WHERE expires_at < CURRENT_TIMESTAMP");
  const retentionDays = Math.max(7, Number(process.env.AUDIT_RETENTION_DAYS ?? 90));
  await getDatabase().query(
    `DELETE FROM audit_runs
     WHERE created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
       AND status IN ('completed', 'failed')`,
    [retentionDays],
  );
}
