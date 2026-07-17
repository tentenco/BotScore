import Link from "next/link";

export default function NotFound() {
  return (
    <main className="audit-shell">
      <section className="error-surface">
        <span className="eyebrow">404 / REPORT NOT FOUND</span>
        <h1>這份報告無法開啟。</h1>
        <p>連結可能已過期、輸入不完整，或報告尚未建立。你可以免費重新檢測網站。</p>
        <Link href="/">回到 BotScore</Link>
      </section>
    </main>
  );
}
