import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { analyzeHtml } from "@/lib/audit/html-analyzer";
import { evaluateRules } from "@/lib/audit/rules";
import { calculateScores } from "@/lib/audit/scoring";
import type { AuditEvidence } from "@/lib/audit/types";

const fixture = fileURLToPath(new URL("./fixtures/healthy.html", import.meta.url));

async function evidence(overrides: { noindex?: boolean; gptBlocked?: boolean } = {}): Promise<AuditEvidence> {
  const html = (await readFile(fixture, "utf8")).replace(
    "</head>",
    `${overrides.noindex ? '<meta name="robots" content="noindex">' : ""}</head>`,
  );
  const page = analyzeHtml(html, "https://example.com/");
  return {
    fetch: {
      requestedUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      status: 200,
      headers: { "content-type": "text/html" },
      body: html,
      redirects: [],
      durationMs: 42,
    },
    rawPage: page,
    renderedPage: page,
    render: { attempted: true, succeeded: true, html, error: null },
    robots: {
      found: true,
      body: "User-agent: *\nAllow: /",
      sitemapUrls: ["https://example.com/sitemap.xml"],
      policies: {
        Googlebot: true,
        Bingbot: true,
        "OAI-SearchBot": true,
        "ChatGPT-User": true,
        GPTBot: overrides.gptBlocked ? false : true,
        "Claude-SearchBot": true,
        "Claude-User": true,
        ClaudeBot: true,
        PerplexityBot: true,
        "Google-Extended": true,
        CCBot: true,
      },
    },
    sitemap: { found: true, valid: true, url: "https://example.com/sitemap.xml", urlCount: 8, sampleUrls: [], error: null },
    llmsTxt: { found: false, valid: false },
  };
}

describe("rules and scoring", () => {
  it("evaluates deterministic rules and produces covered pillar scores", async () => {
    const input = await evidence();
    const findings = evaluateRules(input);
    const scores = calculateScores(findings, input);
    expect(findings.length).toBeGreaterThanOrEqual(40);
    expect(findings.find((item) => item.ruleId === "seo.http.reachable")?.state).toBe("pass");
    expect(scores.seo.score).toBeGreaterThan(70);
    expect(scores.geo.coverage).toBe(100);
    expect(scores.overall).not.toBeNull();
  });

  it("caps an index-blocked page and never scores training bot policy", async () => {
    const input = await evidence({ noindex: true, gptBlocked: true });
    const findings = evaluateRules(input);
    const scores = calculateScores(findings, input);
    expect(findings.find((item) => item.ruleId === "seo.index.meta_robots")?.state).toBe("fail");
    expect(findings.find((item) => item.ruleId === "geo.training.gptbot")).toMatchObject({
      state: "fail",
      weight: 0,
      informational: true,
    });
    expect(scores.overall).toBeLessThanOrEqual(39);
  });
});
