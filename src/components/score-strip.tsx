"use client";

import type { AuditScores, Pillar, PillarScore } from "@/lib/audit/types";
import { getScorePresentation } from "@/lib/audit/score-presentation";
import { useAnimatedNumber } from "@/lib/client/use-animated-number";

const scoreCopy = {
  seo: { title: "SEO", label: "搜尋與索引" },
  aeo: { title: "AEO", label: "答案結構" },
  geo: { title: "GEO", label: "AI 發現與引用" },
  trust: { title: "TRUST", label: "責任與信任" },
};

function ScoreCell({
  name,
  item,
  index,
}: {
  name: Pillar;
  item: PillarScore;
  index: number;
}) {
  const presentation = getScorePresentation(item.score);
  const animatedScore = useAnimatedNumber(item.score, {
    delay: 380 + index * 110,
    duration: 900,
  });
  const value = animatedScore ?? 0;

  return (
    <div className={`score-cell tone-${presentation.tone}`} role="listitem">
      <div className="score-ring" aria-label={`${scoreCopy[name].title} ${item.score ?? "資料不足"} 分`}>
        <svg viewBox="0 0 88 88" aria-hidden="true">
          <circle className="score-ring-track" cx="44" cy="44" r="35" pathLength="100" />
          <circle
            className="score-ring-value"
            cx="44"
            cy="44"
            r="35"
            pathLength="100"
            strokeDasharray={`${value} 100`}
          />
        </svg>
        <b>{animatedScore ?? "—"}</b>
      </div>
      <h3>{scoreCopy[name].title}</h3>
      <p>{scoreCopy[name].label}</p>
      <small>{item.evaluated}/{item.applicable} 項 · {item.coverage}% 證據</small>
    </div>
  );
}

export function ScoreStrip({ scores }: { scores: AuditScores }) {
  return (
    <div className="score-strip" role="list" aria-label="四大準備度指標">
      {(["seo", "aeo", "geo", "trust"] as const).map((key) => {
        return <ScoreCell name={key} item={scores[key]} index={(["seo", "aeo", "geo", "trust"] as const).indexOf(key)} key={key} />;
      })}
    </div>
  );
}
