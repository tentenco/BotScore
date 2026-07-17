"use client";

import type { AuditResult, AuditScores } from "@/lib/audit/types";
import { getScorePresentation } from "@/lib/audit/score-presentation";
import { useAnimatedNumber } from "@/lib/client/use-animated-number";
import { ScoreStrip } from "./score-strip";

export function ScoreOverview({
  scores,
  stats,
}: {
  scores: AuditScores;
  stats: AuditResult["stats"];
}) {
  const score = scores.overall;
  const animatedScore = useAnimatedNumber(score, { delay: 140, duration: 1_050 });
  const value = animatedScore ?? 0;
  const presentation = getScorePresentation(score);

  return (
    <section className="score-overview" aria-labelledby="readiness-score-title">
      <div className="score-overview-head">
        <div>
          <span className="eyebrow">READINESS SCORE</span>
          <h2 id="readiness-score-title">AI 搜尋準備度</h2>
        </div>
        <p>以可驗證證據綜合 SEO、AEO、GEO 與信任訊號；分數代表準備程度，不代表實際排名或引用保證。</p>
      </div>

      <div className="score-overview-body">
        <div
          className={`overall-score tone-${presentation.tone}`}
          aria-label={`整體準備度 ${score ?? "資料不足"} 分，${presentation.label}`}
        >
          <div className="score-gauge">
            <svg viewBox="0 0 240 136" aria-hidden="true">
              <path className="score-gauge-track" d="M 26 116 A 94 94 0 0 1 214 116" pathLength="100" />
              <path
                className="score-gauge-value"
                d="M 26 116 A 94 94 0 0 1 214 116"
                pathLength="100"
                strokeDasharray={`${value} 100`}
              />
            </svg>
            <div className="score-gauge-number">
              <b>{animatedScore ?? "—"}</b>
              <span>/ 100</span>
            </div>
          </div>
          <span className="score-level">{presentation.level ? `LEVEL ${presentation.level}` : "NOT SCORED"}</span>
          <strong>{presentation.label}</strong>
          <p>{presentation.guidance}</p>
          <small>{scores.overallCoverage}% evidence coverage</small>
        </div>

        <ScoreStrip scores={scores} />
      </div>

      <div className="score-evidence-summary" aria-label="規則評估摘要">
        <span><i className="summary-pass" />{stats.passed} 通過</span>
        <span><i className="summary-warn" />{stats.warnings} 待檢視</span>
        <span><i className="summary-fail" />{stats.failed} 問題</span>
        <span><i className="summary-unknown" />{stats.unknown} 未知</span>
      </div>
    </section>
  );
}
