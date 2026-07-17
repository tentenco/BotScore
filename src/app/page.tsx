import { Braces, FileSearch, ScanSearch } from "lucide-react";

import { AuditForm } from "@/components/audit-form";

const dimensions = [
  {
    index: "01",
    label: "SEO",
    title: "能被找到嗎？",
    copy: "HTTP、robots、索引指令、canonical、sitemap、初始 HTML 與結構化資料。",
    icon: ScanSearch,
  },
  {
    index: "02",
    label: "AEO",
    title: "能直接回答嗎？",
    copy: "答案摘要、章節結構、定義、來源、作者、日期與 agent 可操作語意。",
    icon: FileSearch,
  },
  {
    index: "03",
    label: "GEO",
    title: "能被正確引用嗎？",
    copy: "AI 搜尋 crawler、可引用證據、品牌實體、摘要控制與 server-rendered 內容。",
    icon: Braces,
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow reveal">免費 SEO + AI 搜尋準備度檢測</span>
          <h1 className="hero-title reveal reveal-delay-1">
            搜尋引擎看得到你，
            <br />
            <em>AI 會引用你嗎？</em>
          </h1>
          <p className="hero-intro reveal reveal-delay-2">
            輸入一個網址，同時檢查 SEO 基礎、答案可讀性與 AI 搜尋準備度。每個判斷都有觀察證據，不用猜。
          </p>
          <AuditForm />
          <div className="hero-footnote">
            <span>通常 30–60 秒</span>
            <span>不需安裝程式</span>
            <span>檢測公開頁面</span>
          </div>
        </div>

        <aside className="hero-specimen" aria-label="診斷報告預覽">
          <div className="specimen-topline">
            <span>BOTSCORE REPORT</span>
            <span className="specimen-chip">範例</span>
          </div>
          <h2 className="specimen-title">你的<br />搜尋準備度報告</h2>
          <div className="specimen-score">
            <span className="score-number">72</span>
            <div>
              <strong>／ 100</strong>
              <p>整體準備度</p>
            </div>
          </div>
          <div className="specimen-bars">
            <div><span>SEO</span><i style={{ "--bar": "84%" } as React.CSSProperties} /><b>84</b></div>
            <div><span>AEO</span><i style={{ "--bar": "68%" } as React.CSSProperties} /><b>68</b></div>
            <div><span>GEO</span><i style={{ "--bar": "61%" } as React.CSSProperties} /><b>61</b></div>
          </div>
          <ol className="specimen-toc">
            <li><span>01</span> 搜尋與索引基礎</li>
            <li><span>02</span> 答案結構與可信度</li>
            <li><span>03</span> AI 發現與引用條件</li>
          </ol>
          <p className="specimen-more">＋ 完整證據、修正方式與驗證步驟</p>
        </aside>
      </section>

      <section className="dimension-section" id="method">
        <div className="section-heading">
          <span className="eyebrow">一個網址，三個搜尋視角</span>
          <h2>不是另一個只有分數的 SEO checker。</h2>
          <p>我們先收集證據，再用版本化規則判斷。模型可以協助整理語言，但不能改寫檢測事實。</p>
        </div>
        <div className="dimension-grid">
          {dimensions.map((dimension) => {
            const Icon = dimension.icon;
            return (
              <article className="dimension" key={dimension.label}>
                <div className="dimension-index">{dimension.index}</div>
                <Icon size={31} strokeWidth={1.35} />
                <span className="dimension-label">{dimension.label} READINESS</span>
                <h3>{dimension.title}</h3>
                <p>{dimension.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="integrity-section">
        <div className="integrity-quote">
          <blockquote>準備度不是可見度。<br />可被抓取，也不保證會被引用。</blockquote>
        </div>
        <div className="integrity-copy">
          <span className="eyebrow">Built-in honesty</span>
          <p>
            本工具不會把 <code>llms.txt</code> 當成排名因子，也不會把訓練 bot 和搜尋 bot 混為一談。無法取得的證據標為 unknown，不會假裝失敗。
          </p>
          <ul>
            <li><span>01</span>每個問題附上實際觀察值</li>
            <li><span>02</span>規則來源與檢查日期可追溯</li>
            <li><span>03</span>關鍵 crawler 阻擋不會被平均分掩蓋</li>
          </ul>
        </div>
      </section>

      <section className="bottom-cta">
        <span className="eyebrow">Ready to inspect?</span>
        <h2>先找出阻擋，再決定該做什麼。</h2>
        <AuditForm compact />
      </section>
    </main>
  );
}
