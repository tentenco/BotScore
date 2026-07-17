# Audit Rules v0

**Status:** Draft for implementation
**Date:** 2026-07-14
**Purpose:** Convert the reviewed SEO/GEO/AEO skills into a deterministic, source-backed rules registry.

## 1. Rule design principles

1. A rule must evaluate collected evidence, not ask an LLM for a pass/fail opinion.
2. Every result must include the evidence that produced it.
3. Rules that depend on unavailable data return `unknown`, never `fail`.
4. Policy choices such as blocking training bots are informational, not ranking failures.
5. Readiness and observed visibility are separate measurements.
6. Rules with unstable external facts must expire for review.
7. Recommendations must be specific, testable, and reversible where possible.
8. A score never hides a critical crawl or index blocker.

## 2. Rule contract

Illustrative record:

```json
{
  "id": "geo.openai.searchbot_access",
  "version": 1,
  "pillar": "geo",
  "category": "crawler_access",
  "scope": "domain",
  "title": "OAI-SearchBot can crawl the inspected page",
  "detector": "robots_policy",
  "inputs": ["robots_txt", "final_url"],
  "severity_on_fail": "high",
  "weight": 6,
  "public_visibility": "summary",
  "source_url": "https://help.openai.com/en/articles/12627856-publishers-and-developers-faq",
  "source_checked_at": "2026-07-14",
  "review_after": "2026-08-14",
  "recommendation_key": "robots.allow_oai_searchbot",
  "confidence_requirement": "high"
}
```

Required fields:

- Stable ID and independent version.
- Pillar, category, page/domain scope.
- Exact detector and required evidence inputs.
- Severity and score weight.
- Public/gated visibility.
- Primary-source URL where possible.
- Source review and next-review dates.
- Localized recommendation key.
- Confidence requirement.

## 3. Evaluation states

| State | Meaning | Score behavior |
|---|---|---|
| `pass` | Evidence satisfies the rule | Full weight |
| `warn` | Evidence is usable but suboptimal or ambiguous | Partial weight defined by rule |
| `fail` | Evidence clearly violates the rule | Zero weight |
| `unknown` | Collector failed or required evidence is unavailable | Excluded from denominator |
| `not_applicable` | Rule does not apply to this page/site | Excluded from denominator |

Every result also carries:

- `confidence`: high, medium, or low.
- `evidence_ids`: references to immutable evidence records.
- `observed_value`: sanitized fact displayed to the user.
- `expected_value`: the testable target.
- `source_checked_at` and evaluated rule version.

## 4. Scoring

For each pillar:

```text
pillar_score = sum(result_factor × rule_weight) / sum(evaluated_rule_weight) × 100
```

Suggested factors:

- pass = 1.0
- warn = rule-specific, normally 0.4–0.7
- fail = 0
- unknown/not applicable = excluded

Coverage:

```text
coverage = evaluated_applicable_weight / all_applicable_weight
```

Caps:

- Homepage 5xx: overall score capped at 20.
- Homepage blocked by robots or confirmed `noindex`: overall score capped at 39.
- Canonical points to an unrelated origin or a non-indexable target: SEO score capped at 59.
- Coverage below 50%: hide the overall score and show “insufficient evidence.”

These caps are product policy and require validation with fixtures and expert review before launch.

## 5. Evidence collectors

| Collector | Key outputs |
|---|---|
| URL safety | Normalized URL, public IP validation, redirect safety |
| HTTP | Status, redirect chain, headers, TLS, raw HTML, size, timing |
| Robots | Parsed groups and effective policy for each relevant user agent |
| Sitemap | Discovery, validity, indexable/canonical URL sample |
| Rendered browser | Final DOM, rendered text, JSON-LD, viewport, console/network failures |
| HTML semantics | Title, meta, canonical, headings, links, images, landmarks, language |
| Structured data | Raw/rendered blocks, parse status, types, required properties, visible consistency |
| Content | Answer blocks, authorship, dates, citations, definitions, lists/tables, word/section statistics |
| Performance | PSI/CrUX availability, LCP, INP, CLS, Lighthouse categories |
| Technology | Framework/CMS confidence and detected evidence |
| External visibility | Platform-specific prompt runs and citation/source results; phase two only |

## 6. MVP rule inventory

The first release should implement roughly 40 high-confidence rules, then add lower-confidence heuristics behind an experimental label.

### 6.1 SEO Readiness

| ID | Rule | Severity | Evidence | Gate |
|---|---|---:|---|---|
| `seo.http.reachable` | Final page returns a usable 2xx response | Critical | HTTP | Public |
| `seo.http.redirect_chain` | Redirect chain is short and contains no loop | High | HTTP | Public |
| `seo.https.enabled` | Final URL uses HTTPS without mixed critical resources | High | HTTP/browser | Full |
| `seo.index.robots_allowed` | Effective Googlebot policy allows the page | Critical | robots | Public |
| `seo.index.meta_robots` | No accidental `noindex`/`nosnippet` on the target | Critical | raw/rendered meta + headers | Public |
| `seo.index.canonical_present` | Canonical is present on a canonical candidate page | Medium | raw/rendered DOM | Full |
| `seo.index.canonical_valid` | Canonical is absolute, consistent, reachable, and indexable | High | DOM + HTTP | Public |
| `seo.index.raw_rendered_consistency` | Critical robots/canonical directives do not conflict before and after JS | High | raw/rendered DOM | Full |
| `seo.sitemap.discovered` | Sitemap is referenced or found at a known location | Medium | robots/HTTP | Full |
| `seo.sitemap.valid` | Sitemap parses and contains valid absolute URLs | High | sitemap parser | Full |
| `seo.sitemap.sample_quality` | Sample contains canonical, indexable 2xx URLs | High | sitemap + HTTP | Full |
| `seo.page.title_present` | Non-empty title exists | High | raw/rendered DOM | Public |
| `seo.page.title_quality` | Title is descriptive and not obviously generic | Medium | DOM + heuristic | Full |
| `seo.page.description_present` | Meta description exists | Low | DOM | Full |
| `seo.page.h1_present` | Main topic heading exists | Medium | rendered DOM | Full |
| `seo.page.heading_order` | Heading hierarchy has no severe structural break | Low | rendered DOM | Full |
| `seo.page.text_available` | Meaningful main content is available in rendered text | High | rendered DOM | Public |
| `seo.page.initial_html_content` | Important content is not an empty client-only shell | High | raw/rendered comparison | Full |
| `seo.page.viewport` | Mobile viewport is configured | Medium | raw/rendered DOM | Full |
| `seo.links.internal_validity` | Sampled internal links do not contain broken targets | Medium | link crawl | Full |
| `seo.images.alt_coverage` | Meaningful images have useful alt text | Low | rendered DOM | Full |
| `seo.images.dimensions` | Images provide intrinsic dimensions where applicable | Low | rendered DOM | Full |
| `seo.schema.parseable` | Detected JSON-LD parses successfully | Medium | raw/rendered JSON-LD | Full |
| `seo.schema.visible_consistency` | Structured claims match visible page content | High | JSON-LD + rendered text | Full |
| `seo.performance.cwv` | Available field/lab CWV data is classified accurately | Medium | PSI/CrUX | Full |
| `seo.i18n.html_lang` | Document language is declared and plausible | Medium | DOM + language detect | Full |
| `seo.i18n.hreflang_valid` | If alternates exist, codes/targets/reciprocity are valid | High | DOM/sitemap + HTTP | Full |

### 6.2 AEO Readiness

These content checks begin as measured heuristics. They should show the exact observed evidence and avoid pretending there is a universal ranking threshold.

| ID | Rule | Severity | Evidence | Gate |
|---|---|---:|---|---|
| `aeo.answer.direct_summary` | Main topic receives a concise direct explanation near the beginning | Medium | rendered content | Public |
| `aeo.structure.descriptive_headings` | Headings describe user questions/topics rather than generic labels | Medium | rendered content | Full |
| `aeo.structure.self_contained_sections` | Key sections contain independently understandable answers | Medium | rendered content | Full |
| `aeo.structure.lists_tables` | Procedural/comparative content uses appropriate lists or tables | Low | rendered DOM | Full |
| `aeo.content.definition_clarity` | Important entities are clearly defined | Medium | rendered content | Full |
| `aeo.content.claim_attribution` | Material factual claims have nearby sources/attribution | High | content + outbound links | Public |
| `aeo.content.primary_sources` | Cited sources include authoritative or primary references | Medium | content + link classification | Full |
| `aeo.content.authorship` | Author or responsible organization is identifiable | High | content + schema | Public |
| `aeo.content.freshness` | Publish/update dates exist where freshness is material | Medium | content + schema | Full |
| `aeo.content.update_consistency` | Visible and structured dates are consistent | High | content + schema | Full |
| `aeo.content.experience_signals` | Page contains attributable first-hand evidence where relevant | Low | content heuristic | Full |
| `aeo.entity.organization` | Organization identity is clear and internally consistent | Medium | content + schema + site links | Full |
| `aeo.entity.same_as` | Verified profiles are linked consistently where present | Low | schema + links | Full |
| `aeo.agent.semantic_landmarks` | Main content and navigation use understandable semantic structure | Medium | DOM/a11y tree | Full |
| `aeo.agent.named_controls` | Interactive controls have accessible names | Medium | DOM/a11y tree | Full |

### 6.3 GEO Readiness

| ID | Rule | Severity | Evidence | Gate |
|---|---|---:|---|---|
| `geo.google.search_eligibility` | Page is indexable and eligible for a Google snippet | Critical | SEO rule results | Public |
| `geo.openai.searchbot_access` | OAI-SearchBot is allowed | High | robots policy | Public |
| `geo.openai.user_access` | ChatGPT user-directed fetch policy is reported | Info | robots policy | Full |
| `geo.anthropic.searchbot_access` | Claude-SearchBot is allowed | High | robots policy | Public |
| `geo.anthropic.user_access` | Claude-User policy is reported | Medium | robots policy | Full |
| `geo.perplexity.searchbot_access` | PerplexityBot is allowed | High | robots policy | Public |
| `geo.bing.search_access` | Bingbot is allowed for Copilot/Bing discovery | High | robots policy | Full |
| `geo.content.server_accessible` | Important content is available without fragile client-only rendering | High | raw/rendered comparison | Public |
| `geo.content.citable_evidence` | Key claims have attributable evidence and clear entity context | High | AEO rule results | Full |
| `geo.entity.brand_consistency` | Brand name, URL, organization data, and profiles agree | Medium | DOM/schema | Full |
| `geo.snippet.controls` | `nosnippet`, `max-snippet`, and `data-nosnippet` impacts are reported | High | meta/headers/DOM | Full |
| `geo.llms_txt.status` | `llms.txt` presence and validity are reported with zero score weight | Info | HTTP/parser | Full |

### 6.4 Trust and report integrity

These may feed AEO or remain a separate internal quality dimension.

| ID | Rule | Severity | Evidence | Gate |
|---|---|---:|---|---|
| `trust.contact.visible` | Responsible business/contact path is available | Medium | links/content | Full |
| `trust.legal.privacy` | Privacy policy is discoverable | Medium | links/HTTP | Full |
| `trust.legal.terms` | Terms or equivalent business policy is discoverable where expected | Low | links/HTTP | Full |
| `trust.security.https` | Trust-facing pages use HTTPS | High | HTTP | Full |
| `trust.content.corrections` | Editorial correction/update policy is visible where relevant | Low | content | Full |

## 7. Informational checks with zero score weight

These should be visible but not treated as failures:

- `llms.txt` missing or present.
- GPTBot/ClaudeBot/Google-Extended/CCBot training policy.
- FAQPage schema presence after Google retired FAQ rich results.
- Meta keywords presence.
- Social Open Graph/Twitter metadata.
- RSL or other emerging AI licensing files.
- Security headers that are good practice but not direct SEO requirements.

## 8. Rules explicitly rejected for v1

- “Meta keywords are required.”
- “FAQ schema increases AI visibility by 40%.”
- “Adding `llms.txt` increases citation ranking.”
- “Every key answer must be exactly 40–60 or 134–167 words.”
- “All external links require `rel=noopener noreferrer` for SEO.”
- “Blocking GPTBot prevents ChatGPT Search citations.”
- “Allowing ClaudeBot enables Claude web search.”
- “A single model answer proves AI visibility.”
- “Schema alone causes AI citation.”
- “AI crawlers never execute JavaScript.”
- “A missing optional feature means the site is not GEO-ready.”

Some are useful hypotheses or engineering practices, but none should be scored as established ranking facts.

## 9. Crawler-purpose registry

Keep a versioned registry separate from rules because user-agent purposes change.

Current reviewed distinctions:

| Platform | Search/index bot | User-directed fetch | Training/control bot |
|---|---|---|---|
| Google | Googlebot for Search and AI features | Product-specific | Google-Extended controls Gemini training/grounding use but not Google Search indexing |
| OpenAI | OAI-SearchBot | ChatGPT-User or current documented user agent | GPTBot |
| Anthropic | Claude-SearchBot | Claude-User | ClaudeBot |
| Perplexity | PerplexityBot | Perplexity-User | No foundation-model training role assigned to PerplexityBot in current docs |
| Microsoft | Bingbot | Product-specific | Separate policy where documented |

Each entry needs:

- User-agent token.
- Purpose.
- Whether robots rules are respected.
- Official source URL.
- `source_checked_at` and `review_after`.

## 10. Finding contract

Every public finding should have this shape:

```json
{
  "rule_id": "seo.index.meta_robots",
  "state": "fail",
  "severity": "critical",
  "confidence": "high",
  "title": "This page asks search engines not to index it",
  "observed": "<meta name=\"robots\" content=\"noindex\">",
  "impact": "The inspected page is not eligible for normal Google Search results or Google's generative search features.",
  "recommendation": "Confirm whether exclusion is intentional. If this is a public landing page, remove the noindex directive from both raw and rendered HTML.",
  "verification": "Fetch the deployed page and confirm no noindex directive exists in HTML or X-Robots-Tag, then request validation in Search Console.",
  "evidence_ids": ["ev_123"],
  "source_url": "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag"
}
```

The LLM may rewrite `impact` and `recommendation` for clarity and locale, but cannot change rule ID, state, severity, observed evidence, or source.

## 11. LLM narration input/output

Input only:

- Site type and language with confidence.
- Score summary and coverage.
- Normalized findings.
- Approved remediation templates.
- Strict limitations and CTA context.

Do not send:

- Lead email or personal fields.
- HubSpot data.
- Raw cookies, authorization headers, or form values.
- Full uncontrolled HTML unless a narrowly scoped content classifier requires it.

Required output schema:

- Executive summary.
- Top risks referencing rule IDs.
- Quick wins referencing rule IDs.
- Sequenced roadmap with dependencies.
- Limitations.
- No new facts or scores.

If the response fails schema validation twice, use deterministic templates.

## 12. Testing policy

Every rule needs at least:

- One passing fixture.
- One failing fixture.
- One unknown/collector-failure fixture.
- One non-applicable fixture when relevant.
- A regression fixture for any reported false positive.

System fixture families:

- Static HTML.
- Client-rendered SPA.
- Server-rendered app.
- JS-injected JSON-LD.
- Conflicting raw/rendered canonical and robots directives.
- robots block by specific user agent.
- redirect to private IP attempt.
- malformed/oversized HTML.
- valid and invalid multilingual hreflang clusters.
- rate-limited and timed-out external APIs.

Before changing a rule's scoring behavior, run the full fixture suite and record the rule-version change.

## 13. Freshness policy

- Crawler user agents and purposes: monthly review.
- Google generative-search and Search Console behavior: monthly review.
- Structured-data feature status: monthly review.
- OpenRouter routing, privacy, and free limits: monthly review.
- HubSpot API versions: quarterly review and before deploy.
- Stable HTML/HTTP fundamentals: semiannual review.
- Experimental heuristics: review after each 100 completed audits or 10 user disputes, whichever comes first.

An expired unstable rule remains visible internally but returns `unknown` in public scoring until reviewed.
