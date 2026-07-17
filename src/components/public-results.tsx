"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import type { AuditRecord, Finding } from "@/lib/audit/types";
import { canonicalHostname } from "@/lib/audit/result-url";
import { LeadForm } from "./lead-form";
import { ScoreOverview } from "./score-overview";

const stateLabel: Record<Finding["state"], string> = {
  pass: "PASS",
  warn: "REVIEW",
  fail: "ISSUE",
  unknown: "UNKNOWN",
  not_applicable: "N/A",
};

export function PublicResults({ audit }: { audit: AuditRecord }) {
  const result = audit.result!;
  const domain = canonicalHostname(new URL(result.finalUrl).hostname);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared" | "error">("idle");
  const visible = [...result.findings].sort((a, b) => {
    const rank = { fail: 0, warn: 1, unknown: 2, pass: 3, not_applicable: 4 };
    return rank[a.state] - rank[b.state] || b.weight - a.weight;
  });

  async function shareResult() {
    const shareData = {
      title: `${domain} AI 搜尋準備度`,
      text: `${domain} 的 AI 搜尋準備度為 ${result.scores.overall ?? "資料不足"} 分`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareState("shared");
        window.setTimeout(() => setShareState("idle"), 1800);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1800);
    } catch {
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 2200);
    }
  }

  const shareLabel = {
    idle: "分享結果",
    copied: "已複製連結",
    shared: "已分享",
    error: "無法分享",
  }[shareState];

  return (
    <main className="audit-shell">
      <div className="audit-breadcrumb">
        <span>PUBLIC DIAGNOSTIC / {result.ruleVersion}</span>
        <span>/{domain}</span>
      </div>
      <section className="result-head">
        <div>
          <span className="eyebrow">INSPECTION COMPLETE · RESULTS FOR</span>
          <h1>{domain}</h1>
          <p className="result-site-title">{result.title}</p>
          <p className="result-url">{result.finalUrl}</p>
        </div>
        <div className="result-actions">
          <span>最後掃描</span>
          <time dateTime={result.scannedAt}>{new Date(result.scannedAt).toLocaleString("zh-TW")}</time>
          <button type="button" onClick={shareResult} aria-live="polite">
            {shareState === "copied" || shareState === "shared" ? <Check size={17} /> : <Share2 size={17} />}
            {shareLabel}
          </button>
        </div>
      </section>
      <ScoreOverview scores={result.scores} stats={result.stats} />

      <section className="result-grid">
        <article className="result-panel">
          <span className="eyebrow">WHAT THE EVIDENCE SAYS</span>
          <h2>初步診斷</h2>
          <p className="executive-copy">{result.narrative.executiveSummary}</p>
          <div className="finding-list">
            {visible.map((finding) => (
              <div className="finding-row" key={finding.ruleId}>
                <span className={`finding-state state-${finding.state}`}>{stateLabel[finding.state]} / {finding.pillar}</span>
                <div>
                  <h3>{finding.title}</h3>
                  <p>{finding.observed}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="result-panel unlock-panel">
          <span className="eyebrow">{result.findings.length} SHOWN · {Math.max(0, 40 - result.findings.length)}+ LOCKED</span>
          <h2>把問題變成<br />可執行清單。</h2>
          <p>留下 Email，立即解鎖全部規則、觀察證據、修正方式、驗證步驟與來源。</p>
          <div className="locked-preview" aria-hidden="true">
            <div className="locked-line" /><div className="locked-line" /><div className="locked-line" /><div className="locked-line" />
          </div>
          <LeadForm auditId={audit.id} />
        </aside>
      </section>
    </main>
  );
}
