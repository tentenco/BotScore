# Devpost 提交表單內容(直接複製用)

**Track / 類別**: Work & Productivity
**Project name**: BotScore
**Elevator pitch (tagline)**:
> Evidence-based SEO / AEO / GEO auditor — find what stops search engines *and* AI answer engines from discovering, understanding, and citing your site.

---

## About the project(Devpost 主欄位,Markdown)

### Inspiration

Search is splitting in two: engines that **rank** (Google) and engines that **answer** (ChatGPT, Gemini, Perplexity, AI Overviews). Every week, clients at our agency asked the same question — "why doesn't AI cite us?" — and every answer was guesswork. Existing SEO tools measure rankings; nothing credibly measures **readiness** for answer engines. We wanted a tool that produces *evidence*, not AI-generated opinions.

### What it does

BotScore audits any public URL across three dimensions:

- **SEO** — HTTP behavior, redirects, robots policies, indexing directives, canonicals, sitemaps, initial HTML, structured data.
- **AEO** (Answer Engine Optimization) — answer summaries, section structure, definitions, sources, authors, dates: the semantics agents can act on.
- **GEO** (Generative Engine Optimization) — AI-crawler access (GPTBot etc.), citable evidence, brand entities, summary control, server-rendered content.

A durable job queue dispatches an independent worker that fetches both raw and rendered HTML via headless Chromium. Every finding is deterministic and reproducible, backed by a **versioned rules engine** — an LLM layer may narrate findings but never decides pass/fail. The public results page gives real free value; a lightweight email gate unlocks the full prioritized fix plan (HubSpot sync, hashed 7-day report tokens) — so the tool doubles as a qualified-lead funnel for agencies.

### How we built it

The entire product was built with **Codex running GPT-5.6** (`gpt-5.6-sol`), across three sessions on July 14 — inside the Build Week window. Codex worked top-down: it first wrote a product strategy document and a versioned audit-rules spec (both in the repo under `docs/`), then implemented the Next.js app, the PostgreSQL + pg-boss queue, the Playwright/Chromium audit worker, the animated results design system, the Docker Compose + Caddy production stack, and the vitest suite. Codex session IDs are listed in the README.

### Challenges we ran into

- Making audits **credible**: separating deterministic evidence from LLM narration so the tool never hallucinates a pass/fail.
- Rendering vs. raw HTML: many GEO failures only show when you compare what crawlers get with what browsers render.
- Making a heavyweight pipeline (queue + worker + headless browser) run as one `docker compose up`.

### Accomplishments that we're proud of

A production-grade stack — not a demo: durable jobs that survive restarts, atomic quotas, rate-limit salting, health endpoints, backup/restore docs. And a rules engine you can version and audit.

### What we learned

GPT-5.6 with Codex can carry *architecture*, not just code completion — the strategy docs it wrote first made every later implementation session dramatically more coherent.

### What's next

Observed-visibility measurement (does ChatGPT actually cite you for a prompt set), multi-language rule packs (zh-TW first), and scheduled re-audits with diff alerts.

---

## Built with(逗號分隔標籤)

typescript, next.js, react, postgresql, pg-boss, playwright, chromium, docker, caddy, vitest, openai, gpt-5.6, codex, hubspot, listmonk

## 其他表單欄位

- **Video demo link**: https://youtu.be/lXHMuYjV_FI (EN) · https://youtu.be/2k-hiPKae10 (中文版)
- **Public code repo**: https://github.com/tentenco/BotScore
- **Codex Session IDs**(README 也有):
  - `019f5eaf-ca2f-7340-920b-0f3fee0755ed`
  - `019f5f32-4e3a-71d3-a79a-6ea030c62cd6`
  - `019f5f5b-72ad-7251-b748-3629aadeb50b`
