"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import type { AuditRecord } from "@/lib/audit/types";
import { useAnimatedNumber } from "@/lib/client/use-animated-number";
import { PublicResults } from "./public-results";

const stages = [
  { at: 5, index: "01", label: "安全取得頁面" },
  { at: 25, index: "02", label: "Crawler 政策" },
  { at: 50, index: "03", label: "渲染與內容" },
  { at: 75, index: "04", label: "規則與計分" },
  { at: 90, index: "05", label: "行動摘要" },
];

export function AuditLive({ auditId }: { auditId: string }) {
  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [requestError, setRequestError] = useState("");
  const progress = audit?.progress ?? 2;
  const displayProgress = useAnimatedNumber(progress, { duration: 520 }) ?? progress;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    function nextPollDelay() {
      if (typeof document !== "undefined" && document.hidden) return 10_000;
      const elapsed = Date.now() - startedAt;
      const base = elapsed < 10_000 ? 1_250 : elapsed < 60_000 ? 2_500 : 5_000;
      return base + Math.round(Math.random() * 300);
    }

    async function poll() {
      try {
        const response = await fetch(`/api/audits/${auditId}`, { cache: "no-store" });
        const data = (await response.json()) as AuditRecord & { error?: string };
        if (!response.ok) throw new Error(data.error || "找不到檢測結果");
        if (cancelled) return;
        setAudit(data);
        if (data.status === "queued" || data.status === "running") {
          timer = setTimeout(poll, nextPollDelay());
        }
      } catch (error) {
        if (!cancelled) {
          setRequestError(error instanceof Error ? error.message : "無法讀取檢測結果");
          timer = setTimeout(poll, 5_000 + Math.round(Math.random() * 500));
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [auditId]);

  if (requestError || audit?.status === "failed") {
    return (
      <main className="audit-shell">
        <div className="audit-breadcrumb"><span>INSPECTION ERROR</span><span>{audit?.url}</span></div>
        <section className="error-surface">
          <span className="eyebrow">SCAN INTERRUPTED</span>
          <h1>這次檢測沒有完成。</h1>
          <p>{requestError || audit?.error || "目標網站目前無法安全存取，請稍後再試。"}</p>
          <Link href="/">重新輸入網址</Link>
        </section>
      </main>
    );
  }

  if (audit?.status === "completed" && audit.result) {
    return <PublicResults audit={audit} />;
  }

  const currentStage = stages.findIndex((stage) => progress < stage.at);
  return (
    <main className="audit-shell">
      <div className="audit-breadcrumb">
        <span>LIVE INSPECTION / {auditId.slice(0, 8)}</span>
        <span>{audit?.url ?? "正在建立安全檢測…"}</span>
      </div>
      <section className="progress-stage">
        <span className="eyebrow">EVIDENCE COLLECTION IN PROGRESS</span>
        <h1>正在讀懂<br />這個網站。</h1>
        <p>我們會分開檢查原始 HTML、瀏覽器渲染、robots、sitemap 與 AI crawler 政策。請保留這個頁面。</p>
        <div className="progress-meter">
          <div
            className="progress-meter-track"
            role="progressbar"
            aria-label="網站檢測進度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <i style={{ transform: `scaleX(${displayProgress / 100})` }} />
          </div>
          <div className="progress-meta">
            <span aria-live="polite">{audit?.stage ?? "準備檢測"}</span>
            <span><span aria-hidden="true">{displayProgress}%</span><span className="sr-only">{progress}%</span></span>
          </div>
        </div>
        <div className="stage-list">
          {stages.map((stage, index) => {
            const state = progress >= stage.at ? "complete" : index === currentStage ? "current" : "pending";
            return (
              <div className={`stage-item ${state}`} key={stage.index}>
                <span className="stage-index">{state === "complete" ? <Check size={12} strokeWidth={2.5} /> : stage.index}</span>
                <span className="stage-label">{stage.label}</span>
                {state === "current" ? <span className="stage-live">ACTIVE</span> : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
