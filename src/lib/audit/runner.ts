import { analyzeHtml } from "./html-analyzer";
import { createNarrative } from "./narrator";
import { renderPage } from "./renderer";
import { collectRobots } from "./robots";
import { evaluateRules } from "./rules";
import { safeFetchText } from "./safe-fetch";
import { calculateScores } from "./scoring";
import { collectSitemap } from "./sitemap";
import { RULE_VERSION } from "./sources";
import type { AuditEvidence, AuditResult } from "./types";

type ProgressCallback = (progress: number, stage: string) => Promise<void> | void;

async function collectLlmsTxt(url: string) {
  try {
    const response = await safeFetchText(new URL("/llms.txt", url).toString(), {
      maxBytes: 300_000,
      timeoutMs: 8_000,
    });
    if (response.status < 200 || response.status >= 300) return { found: false, valid: false };
    const body = response.body.trim();
    return {
      found: true,
      valid: /^#\s+.+/m.test(body) && /https?:\/\//i.test(body),
    };
  } catch {
    return { found: false, valid: false };
  }
}

export async function runAudit(
  id: string,
  requestedUrl: string,
  onProgress: ProgressCallback = () => undefined,
): Promise<AuditResult> {
  const startedAt = performance.now();
  await onProgress(8, "正在安全連線並取得網站");
  const fetchEvidence = await safeFetchText(requestedUrl);
  const rawPage = analyzeHtml(fetchEvidence.body, fetchEvidence.finalUrl);

  await onProgress(25, "正在讀取 crawler 與 sitemap 政策");
  const [robots, llmsTxt, render] = await Promise.all([
    collectRobots(fetchEvidence.finalUrl),
    collectLlmsTxt(fetchEvidence.finalUrl),
    renderPage(fetchEvidence.finalUrl),
  ]);

  await onProgress(55, "正在分析渲染內容與結構化資料");
  const renderedPage = render.succeeded
    ? analyzeHtml(render.html, fetchEvidence.finalUrl)
    : rawPage;
  const sitemap = await collectSitemap(fetchEvidence.finalUrl, robots.sitemapUrls);
  const evidence: AuditEvidence = {
    fetch: fetchEvidence,
    rawPage,
    renderedPage,
    render,
    robots,
    sitemap,
    llmsTxt,
  };

  await onProgress(75, "正在套用可驗證的 SEO、AEO、GEO 規則");
  const findings = evaluateRules(evidence);
  const scores = calculateScores(findings, evidence);

  await onProgress(90, "正在整理優先順序與行動摘要");
  const narrative = await createNarrative(
    renderedPage.title,
    fetchEvidence.finalUrl,
    scores,
    findings,
  );

  return {
    id,
    requestedUrl,
    finalUrl: fetchEvidence.finalUrl,
    scannedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    title: renderedPage.title || new URL(fetchEvidence.finalUrl).hostname,
    scores,
    findings,
    narrative,
    stats: {
      passed: findings.filter((finding) => finding.state === "pass").length,
      warnings: findings.filter((finding) => finding.state === "warn").length,
      failed: findings.filter((finding) => finding.state === "fail").length,
      unknown: findings.filter((finding) => finding.state === "unknown").length,
    },
    technical: {
      status: fetchEvidence.status,
      rendered: render.succeeded,
      redirects: fetchEvidence.redirects.length,
      sitemapUrls: sitemap.urlCount,
      schemaTypes: renderedPage.jsonLd.types,
      wordCount: renderedPage.wordCount,
    },
    ruleVersion: RULE_VERSION,
  };
}
