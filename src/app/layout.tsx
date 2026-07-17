import "@fontsource-variable/inter/index.css";
import "@fontsource/noto-sans-tc/300.css";
import "@fontsource/noto-sans-tc/400.css";
import "@fontsource/noto-sans-tc/500.css";
import "@fontsource/noto-sans-tc/700.css";
import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, AtSign, Facebook, Instagram, Linkedin, Youtube } from "lucide-react";

import { groupSites, socialLinks } from "@/lib/group-links";

export const metadata: Metadata = {
  title: "BotScore — SEO × AEO × GEO 免費檢測",
  description:
    "用一個網址檢查搜尋索引、答案結構與 AI crawler readiness。免費取得可驗證的 SEO、AEO、GEO 診斷。",
};

const socialIcons = {
  Facebook,
  Instagram,
  LinkedIn: Linkedin,
  Threads: AtSign,
  YouTube: Youtube,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://tenten.co/#organization",
  name: "Tenten",
  url: "https://tenten.co/",
  sameAs: socialLinks.map((social) => social.href),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
        />
      </head>
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="wordmark" href="/" aria-label="BotScore 首頁">
              <span className="wordmark-brand">tenten</span>
              <span className="wordmark-product">BotScore</span>
            </Link>
            <nav className="header-nav" aria-label="主要導覽">
              <Link href="/">免費檢測</Link>
              <a href="https://geo.tenten.co/" target="_blank" rel="noreferrer">GEO 服務</a>
            </nav>
            <a className="header-link" href="https://geo.tenten.co/" target="_blank" rel="noreferrer">
              預約策略會議 <ArrowUpRight size={15} strokeWidth={1.8} />
            </a>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="footer-intro">
              <div>
                <p className="footer-brand">BotScore <span>by Tenten</span></p>
                <p className="footer-statement">讓品牌更容易被搜尋、理解，並被正確引用。</p>
              </div>
              <a className="footer-contact" href="https://geo.tenten.co/" target="_blank" rel="noopener noreferrer">
                預約 GEO 策略會議 <ArrowUpRight size={16} />
              </a>
            </div>

            <section className="footer-network" aria-labelledby="tenten-network-title">
              <div className="footer-section-copy">
                <span className="eyebrow">Tenten Network</span>
                <h2 id="tenten-network-title">同一個集團，一套完整的數位成長能力。</h2>
                <p>從品牌、商務與 AI 導入，到搜尋能見度與內容製作，找到最適合你下一步的 Tenten 團隊。</p>
              </div>
              <div className="footer-site-grid">
                {groupSites.map((site) => (
                  <a className="footer-site-card" href={site.href} key={site.domain} target="_blank" rel="noopener noreferrer">
                    <span className="footer-site-card-top">
                      <b>{site.name}</b>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </span>
                    <span>{site.description}</span>
                    <small>{site.domain}</small>
                  </a>
                ))}
              </div>
            </section>

            <section className="footer-social" aria-labelledby="social-title">
              <div>
                <span className="eyebrow">Follow Tenten</span>
                <h2 id="social-title">追蹤我們</h2>
                <p>取得 AI、GEO、設計、商務與數位成長的最新觀察。</p>
              </div>
              <nav className="social-links" aria-label="Tenten 社群連結">
                {socialLinks.map((social) => {
                  const Icon = socialIcons[social.name];
                  return (
                    <a href={social.href} key={social.name} target="_blank" rel="noopener noreferrer" aria-label={`在 ${social.name} 追蹤 Tenten`}>
                      <Icon size={17} aria-hidden="true" />
                      <span>{social.name}</span>
                    </a>
                  );
                })}
              </nav>
            </section>

            <div className="footer-bottom">
              <p className="footer-fine">本工具衡量搜尋與 AI 準備度，不代表實際排名或引用結果。© 2026 Tenten Co., Ltd.</p>
              <nav className="footer-meta" aria-label="頁尾導覽">
                <Link href="/">免費檢測</Link>
                <a href="https://tentencommerce.com/" target="_blank" rel="noopener noreferrer">Tenten Commerce</a>
                <a href="https://tenten.co/" target="_blank" rel="noopener noreferrer">Tenten 首頁</a>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
