# BotScore — 3 分鐘 Demo 影片腳本

> 規則要求:影片 < 3:00、上傳 YouTube、要有**旁白**清楚說明「做了什麼」+「如何使用 Codex 與 GPT-5.6」。不得出現未授權的版權素材或第三方商標(錄製時避免拍到其他品牌 logo)。
> 錄製建議:1080p 螢幕錄影(QuickTime 或 Screen Studio),旁白用英文(評審是英文)。每段畫面先操作一次排練,再正式錄。

## 時間軸總覽

| 時間 | 畫面 | 內容 |
|---|---|---|
| 0:00–0:20 | 首頁 hero | Hook:問題陳述 |
| 0:20–0:50 | 送出網址、audit 進行中 | 即時掃描 demo |
| 0:50–1:45 | 公開結果頁動畫 | 三大維度(SEO/AEO/GEO)與證據 |
| 1:45–2:10 | Email gate → 完整報告 | 商業模式(lead funnel) |
| 2:10–2:50 | 終端機 + docs + session | **Codex + GPT-5.6 如何打造這個產品** |
| 2:50–3:00 | 回到結果頁 | 收尾 |

---

## 逐段腳本(英文旁白 + 中文對照)

### SCENE 1 — Hook(0:00–0:20)
**畫面**:首頁 hero,滑鼠緩慢下捲帶出三個維度卡片。

**旁白 (EN)**:
"Your website might rank on Google — but is it *citable* by ChatGPT, Gemini, and Perplexity? Most sites have no idea. BotScore is a search-readiness auditor that answers one question with evidence: can search engines *and* AI answer engines discover, understand, and cite your site?"

**中文對照**:你的網站也許在 Google 排得上,但 ChatGPT、Gemini、Perplexity 引用得到你嗎?BotScore 用證據回答一件事:搜尋引擎「和」AI 答案引擎能不能發現、理解、引用你的網站。

### SCENE 2 — Live audit(0:20–0:50)
**畫面**:在首頁輸入一個真實網址(建議用 tenten.co 或你們客戶同意的網站)→ 按下送出 → 轉到 `/audit/[id]` 進度畫面。

**旁白 (EN)**:
"Paste a URL and the inspector goes to work. A durable job queue dispatches an independent worker that fetches both raw and rendered HTML with headless Chromium — then checks redirects, robots policies, canonicals, sitemaps, structured data, and whether AI crawlers like GPTBot are allowed in. Every finding is deterministic, reproducible evidence — not an AI's opinion."

**中文對照**:貼上網址,持久化任務佇列派出獨立 worker,用 headless Chromium 抓原始與渲染後的 HTML,檢查轉址、robots、canonical、sitemap、結構化資料,以及 GPTBot 等 AI crawler 是否被擋。每個發現都是可重現的證據,不是 AI 的主觀意見。

### SCENE 3 — Results(0:50–1:45)
**畫面**:公開結果頁動畫載入,逐一停留在三個維度區塊(每個約 15 秒),放大 1–2 個具體 finding。

**旁白 (EN)**:
"Results come back in three dimensions. **SEO** — the technical layer: HTTP, indexing directives, canonical, sitemap, initial HTML and structured data. **AEO** — answer engine optimization: does the page have answer summaries, section structure, definitions, sources, authors, dates — the semantics agents can act on? And **GEO** — generative engine optimization: AI crawler access, citable evidence, brand entities, and server-rendered content. Each check shows its evidence, so a marketer and a developer see the same truth."

**中文對照**:結果分三個維度。SEO 是技術層;AEO 看頁面有沒有答案摘要、章節結構、定義、來源、作者、日期這些 agent 可操作的語意;GEO 看 AI crawler 存取、可引用證據、品牌實體與 server 渲染。每項檢查都附證據,行銷和工程看到同一份事實。

### SCENE 4 — Funnel(1:45–2:10)
**畫面**:結果頁下方留 email → 收到(或直接開)`/report/[token]` 完整報告頁。

**旁白 (EN)**:
"The public page gives real value for free. The full prioritized fix plan sits behind a lightweight email gate — leads sync to HubSpot, and a hashed seven-day token renders the complete server-side report. That's the business model: credible diagnostics in, qualified leads out."

**中文對照**:公開頁免費給出真價值;完整的優先修復計畫放在輕量 email gate 後 — 名單同步 HubSpot,7 天雜湊 token 開啟完整報告。這就是商業模式:給出可信診斷,換取合格名單。

### SCENE 5 — How it was built(2:10–2:50)⚠️ 規則必要段落
**畫面**:切到終端機,`ls docs/` 顯示四份產品文件 → 開 `docs/PRODUCT_STRATEGY.md` 快速捲動 → 顯示 README 的 Codex session ID 區塊(或 `codex` CLI 畫面)。

**旁白 (EN)**:
"This entire product was built with **Codex running GPT-5.6** — across three sessions in one day. I worked with Codex the way you'd work with a senior team: it drafted the product strategy and a versioned audit-rules spec first, then implemented the scanner, the job queue and worker, the API, the animated results system, the Docker production stack — and the tests and docs you're seeing. The Codex session IDs are in the README, and the four design documents in the repo were part of the same sessions. GPT-5.6 didn't just autocomplete code — it carried the architecture."

**中文對照**:整個產品由 Codex(GPT-5.6)在一天內的三個 session 打造 — 先產出產品策略與版本化稽核規則,再實作掃描器、佇列與 worker、API、動畫結果系統、Docker 生產環境和測試文件。Session ID 都在 README。

### SCENE 6 — Close(2:50–3:00)
**畫面**:回到結果頁總覽,停在品牌畫面。

**旁白 (EN)**:
"Search is splitting into engines that rank and engines that answer. BotScore makes sure you're ready for both. Thanks for watching."

**中文對照**:搜尋正在分裂成「排序的引擎」和「回答的引擎」,BotScore 讓你兩邊都準備好。

---

## 錄製檢查清單

- [ ] 本機先跑起來:`pnpm dev` + `pnpm worker`(需 PostgreSQL;或 `docker compose up`)
- [ ] 預先跑一次 audit,確認 demo 網址的結果頁好看
- [ ] 瀏覽器:關書籤列、關通知、開無痕視窗、100% 縮放
- [ ] 錄旁白時參照上面英文稿(可先錄畫面再配音)
- [ ] 總長 **必須 < 3:00**
- [ ] 上傳 YouTube(公開或不公開連結皆可,評審要能看)
- [ ] 影片內不要出現客戶網站以外的第三方商標
