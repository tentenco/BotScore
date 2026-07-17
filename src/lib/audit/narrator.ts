import { z } from "zod";

import type { AuditNarrative, AuditScores, Finding } from "./types";

const NarrativeSchema = z.object({
  executiveSummary: z.string().min(20).max(700),
  topRisks: z.array(z.string().min(5).max(240)).max(4),
  quickWins: z.array(z.string().min(5).max(240)).max(4),
  limitations: z.array(z.string().min(5).max(240)).min(1).max(4),
});

const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
const stateRank = { fail: 0, warn: 1, unknown: 2, pass: 3, not_applicable: 4 } as const;

function important(findings: Finding[], states: Finding["state"][]) {
  return findings
    .filter((finding) => states.includes(finding.state) && !finding.informational)
    .sort(
      (a, b) =>
        stateRank[a.state] - stateRank[b.state] ||
        severityRank[a.severity] - severityRank[b.severity] ||
        b.weight - a.weight,
    );
}

export function deterministicNarrative(
  title: string,
  scores: AuditScores,
  findings: Finding[],
): AuditNarrative {
  const risks = important(findings, ["fail", "warn"]);
  const quickWins = risks.filter((finding) => finding.severity !== "critical").slice(0, 3);
  const scoreLine = [
    `SEO ${scores.seo.score ?? "證據不足"}`,
    `AEO ${scores.aeo.score ?? "證據不足"}`,
    `GEO ${scores.geo.score ?? "證據不足"}`,
  ].join("、");
  const criticalCount = findings.filter(
    (finding) => finding.state === "fail" && finding.severity === "critical",
  ).length;

  return {
    executiveSummary: `${title || "此網站"}的可搜尋與可引用準備度為：${scoreLine}。${
      criticalCount
        ? `目前有 ${criticalCount} 個關鍵阻擋，應先修復抓取或索引資格，再投入內容層優化。`
        : "目前沒有偵測到關鍵抓取阻擋，可依高影響問題逐步提升內容結構、實體清晰度與引用證據。"
    }`,
    topRisks: risks.slice(0, 3).map((finding) => `${finding.title}：${finding.observed}`),
    quickWins: quickWins.map((finding) => `${finding.title}：${finding.recommendation}`),
    limitations: [
      "本報告衡量技術與內容的準備度，不代表已在任何 AI 答案中獲得曝光或引用。",
      "單頁檢測不能取代全站 crawl、Search Console、log 或真實查詢可見度資料。",
      "內容與來源品質的部分判斷是透明的啟發式檢查，應由專家複核。",
    ],
    generatedBy: "deterministic",
  };
}

export async function createNarrative(
  title: string,
  url: string,
  scores: AuditScores,
  findings: Finding[],
): Promise<AuditNarrative> {
  const fallback = deterministicNarrative(title, scores, findings);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || process.env.ENABLE_OPENROUTER_NARRATIVE !== "true") return fallback;

  const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";
  const evidence = important(findings, ["fail", "warn", "pass"])
    .slice(0, 18)
    .map((finding) => ({
      id: finding.ruleId,
      pillar: finding.pillar,
      state: finding.state,
      severity: finding.severity,
      observed: finding.observed,
      recommendation: finding.recommendation,
    }));

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "http-referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://github.com/tentenco/BotScore",
        "x-title": "BotScore",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        provider: { data_collection: "deny", require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "audit_narrative",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                executiveSummary: { type: "string" },
                topRisks: { type: "array", items: { type: "string" }, maxItems: 4 },
                quickWins: { type: "array", items: { type: "string" }, maxItems: 4 },
                limitations: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
              },
              required: ["executiveSummary", "topRisks", "quickWins", "limitations"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "你是網站診斷報告編輯。只可解讀提供的規則證據，不可新增事實、宣稱排名或保證 AI 引用。使用繁體中文，具體、克制、可執行。",
          },
          {
            role: "user",
            content: JSON.stringify({ url, title, scores, evidence }),
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return fallback;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = NarrativeSchema.parse(JSON.parse(content));
    return { ...parsed, generatedBy: "openrouter", model };
  } catch {
    return fallback;
  }
}
