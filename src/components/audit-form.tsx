"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function AuditForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as { id?: string; path?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "無法開始檢測");
      router.push(data.path || `/audit/${data.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "無法開始檢測");
      setLoading(false);
    }
  }

  return (
    <form className={`audit-form ${compact ? "audit-form-compact" : ""}`} onSubmit={submit}>
      <label htmlFor={compact ? "site-url-bottom" : "site-url"}>網站網址</label>
      <div className="audit-input-row">
        <span className="protocol-mark">↳</span>
        <input
          id={compact ? "site-url-bottom" : "site-url"}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourwebsite.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          aria-describedby={error ? `${compact ? "bottom-" : ""}url-error` : undefined}
        />
        <button type="submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={21} />}
          <span>{loading ? "建立檢測" : "免費檢測"}</span>
        </button>
      </div>
      {error ? (
        <p className="form-error" id={`${compact ? "bottom-" : ""}url-error`} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
