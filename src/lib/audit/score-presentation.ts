export type ScoreTone = "strong" | "good" | "watch" | "critical" | "unknown";

export interface ScorePresentation {
  level: number | null;
  label: string;
  tone: ScoreTone;
  guidance: string;
}

export function getScorePresentation(score: number | null): ScorePresentation {
  if (score === null) {
    return {
      level: null,
      label: "資料不足",
      tone: "unknown",
      guidance: "需要更多可驗證證據才能形成可靠判讀。",
    };
  }
  if (score >= 90) {
    return {
      level: 5,
      label: "高度準備",
      tone: "strong",
      guidance: "核心條件完整，下一步是持續驗證與維護。",
    };
  }
  if (score >= 75) {
    return {
      level: 4,
      label: "穩健基礎",
      tone: "good",
      guidance: "已有良好基礎，少數缺口仍會限制可見度。",
    };
  }
  if (score >= 60) {
    return {
      level: 3,
      label: "有明顯缺口",
      tone: "watch",
      guidance: "部分條件可用，但關鍵缺口需要排入改善。",
    };
  }
  if (score >= 40) {
    return {
      level: 2,
      label: "需要優先改善",
      tone: "critical",
      guidance: "多項基礎訊號不足，建議先處理高影響阻擋。",
    };
  }
  return {
    level: 1,
    label: "關鍵條件不足",
    tone: "critical",
    guidance: "網站目前缺少多個可被搜尋與 AI 系統使用的條件。",
  };
}
