import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { ScoreOverview } from "@/components/score-overview";
import type { Finding, Pillar } from "@/lib/audit/types";
import { canonicalHostname } from "@/lib/audit/result-url";
import { getReportByToken } from "@/lib/server/database";

export const dynamic = "force-dynamic";

const pillarLabels: Record<Pillar, { label: string; title: string }> = {
  seo: { label: "01 / SEO READINESS", title: "搜尋與索引基礎" },
  aeo: { label: "02 / AEO READINESS", title: "答案結構與可信度" },
  geo: { label: "03 / GEO READINESS", title: "AI 發現與引用條件" },
  trust: { label: "04 / TRUST", title: "責任、聯絡與政策" },
};

const stateLabel: Record<Finding["state"], string> = {
  pass: "PASS",
  warn: "REVIEW",
  fail: "ISSUE",
  unknown: "UNKNOWN",
  not_applicable: "N/A",
};

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <article className="report-finding">
      <div className="report-finding-head">
        <span className={`state-${finding.state}`}>{stateLabel[finding.state]} / {finding.severity.toUpperCase()}</span>
        <span>{finding.ruleId}</span>
      </div>
      <h3>{finding.title}</h3>
      <p><b>觀察：</b>{finding.observed}</p>
      <p><b>影響：</b>{finding.impact}</p>
      <p><b>建議：</b>{finding.recommendation}</p>
      <p><b>驗證：</b>{finding.verification}</p>
      <a href={finding.sourceUrl} target="_blank" rel="noreferrer">規則來源 · {finding.sourceCheckedAt} ↗</a>
    </article>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await getReportByToken(token);
  if (!access) notFound();
  const result = access.audit.result!;
  const domain = canonicalHostname(new URL(result.finalUrl).hostname);
  const ordered = [...result.findings].sort((a, b) => {
    const rank = { fail: 0, warn: 1, unknown: 2, pass: 3, not_applicable: 4 };
    return rank[a.state] - rank[b.state] || b.weight - a.weight;
  });

  return (
    <main className="audit-shell">
      <div className="audit-breadcrumb">
        <span>FULL DIAGNOSTIC / {result.ruleVersion}</span>
        <span>ACCESS EXPIRES {new Date(access.expiresAt).toLocaleDateString("zh-TW")}</span>
      </div>
      <div className="report-banner">
        <span>完整報告已解鎖 · {result.findings.length} 項規則</span>
        <span>準備度檢測，不等於實際 AI 引用或排名</span>
      </div>
      <section className="result-head">
        <div>
          <span className="eyebrow">COMPLETE EVIDENCE REPORT</span>
          <h1>{domain}</h1>
          <p className="result-site-title">{result.title}</p>
          <p className="result-url">{result.finalUrl}</p>
        </div>
      </section>
      <ScoreOverview scores={result.scores} stats={result.stats} />

      <section className="report-section">
        <div className="report-section-head">
          <span className="eyebrow">EXECUTIVE READOUT</span>
          <div>
            <h2>先處理阻擋，再累積可引用性。</h2>
            <p className="executive-copy">{result.narrative.executiveSummary}</p>
          </div>
        </div>
        <div className="result-grid">
          <article className="result-panel">
            <span className="eyebrow">TOP RISKS</span>
            <div className="finding-list">
              {result.narrative.topRisks.map((risk, index) => (
                <div className="finding-row" key={risk}><span className="finding-state state-fail">0{index + 1}</span><div><h3>{risk}</h3></div></div>
              ))}
            </div>
          </article>
          <article className="result-panel">
            <span className="eyebrow">QUICK WINS</span>
            <div className="finding-list">
              {result.narrative.quickWins.map((win, index) => (
                <div className="finding-row" key={win}><span className="finding-state state-pass">0{index + 1}</span><div><h3>{win}</h3></div></div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {(["seo", "aeo", "geo", "trust"] as Pillar[]).map((pillar) => {
        const findings = ordered.filter((finding) => finding.pillar === pillar);
        return (
          <section className="report-section" key={pillar}>
            <div className="report-section-head">
              <span className="eyebrow">{pillarLabels[pillar].label}</span>
              <h2>{pillarLabels[pillar].title}</h2>
            </div>
            <div className="report-findings">
              {findings.map((finding) => <FindingCard finding={finding} key={finding.ruleId} />)}
            </div>
          </section>
        );
      })}

      <section className="report-section">
        <div className="report-section-head">
          <span className="eyebrow">LIMITATIONS</span>
          <div>
            <h2>這份報告沒有聲稱什麼</h2>
            <ul className="executive-copy">
              {result.narrative.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <aside className="consultation-cta">
        <div>
          <h2>需要把診斷變成 GEO 路線圖？</h2>
          <p>Tenten 可協助全站 audit、實體策略、內容系統與 AI 可見度量測。</p>
        </div>
        <a href="https://geo.tenten.co/" target="_blank" rel="noreferrer">了解 GEO 顧問服務 <ArrowUpRight size={16} /></a>
      </aside>
    </main>
  );
}
