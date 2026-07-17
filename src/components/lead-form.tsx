"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function LeadForm({ auditId }: { auditId: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auditId, email, name, company, marketingConsent }),
      });
      const data = (await response.json()) as { reportToken?: string; error?: string };
      if (!response.ok || !data.reportToken) throw new Error(data.error || "無法建立完整報告");
      window.location.assign(`/report/${data.reportToken}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法建立完整報告");
      setLoading(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <label htmlFor="lead-email">工作 Email *</label>
      <input id="lead-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
      <div className="optional-fields">
        <div><label htmlFor="lead-name">姓名（選填）</label><input id="lead-name" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><label htmlFor="lead-company">公司（選填）</label><input id="lead-company" type="text" autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} /></div>
      </div>
      <label className="consent-line">
        <input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)} />
        <span>我願意收到 Tenten 的 GEO 分析、研究與服務資訊（選填，可隨時取消）。</span>
      </label>
      <button className="lead-submit" type="submit" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
        {loading ? "正在建立報告" : "解鎖完整診斷"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="privacy-note">診斷報告屬本次請求的服務信件；是否訂閱行銷內容由上方選項獨立決定。</p>
    </form>
  );
}
