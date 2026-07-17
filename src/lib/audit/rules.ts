import { SOURCE_CHECKED_AT, SOURCES } from "./sources";
import type {
  AuditEvidence,
  Confidence,
  Finding,
  Pillar,
  RuleState,
  Severity,
} from "./types";

type FindingInput = Omit<
  Finding,
  "state" | "observed" | "confidence" | "sourceCheckedAt"
> & {
  state: RuleState;
  observed: string;
  confidence?: Confidence;
};

function finding(input: FindingInput): Finding {
  return {
    ...input,
    confidence: input.confidence ?? "high",
    sourceCheckedAt: SOURCE_CHECKED_AT,
  };
}

function hasDirective(value: string, directive: string) {
  return new RegExp(`(?:^|[,\\s])${directive}(?:$|[,\\s:])`, "i").test(value);
}

function robotState(policy: boolean | null | undefined): RuleState {
  if (policy === true) return "pass";
  if (policy === false) return "fail";
  return "unknown";
}

function robotObserved(agent: string, policy: boolean | null | undefined) {
  if (policy === true) return `${agent} 可抓取此頁`;
  if (policy === false) return `robots.txt 阻擋 ${agent}`;
  return `無法確認 ${agent} 的有效規則`;
}

function headingHasSevereJump(levels: number[]) {
  return levels.some((level, index) => index > 0 && level - levels[index - 1] > 1);
}

function canonicalStatus(canonical: string | null, finalUrl: string) {
  if (!canonical) return { state: "fail" as const, observed: "未偵測到 canonical" };
  try {
    const target = new URL(canonical, finalUrl);
    const current = new URL(finalUrl);
    if (!["http:", "https:"].includes(target.protocol)) {
      return { state: "fail" as const, observed: `canonical 使用 ${target.protocol}` };
    }
    if (target.origin !== current.origin) {
      return {
        state: "warn" as const,
        observed: `canonical 指向不同網域：${target.origin}`,
      };
    }
    return { state: "pass" as const, observed: target.toString() };
  } catch {
    return { state: "fail" as const, observed: `canonical 無法解析：${canonical}` };
  }
}

export function evaluateRules(evidence: AuditEvidence): Finding[] {
  const { fetch, rawPage, renderedPage, render, robots, sitemap, llmsTxt } = evidence;
  const findings: Finding[] = [];
  const finalUrl = fetch.finalUrl;
  const xRobots = fetch.headers["x-robots-tag"]?.toLowerCase() ?? "";
  const combinedRobots = [rawPage.metaRobots, renderedPage.metaRobots, xRobots]
    .filter(Boolean)
    .join(", ");
  const noindex = hasDirective(combinedRobots, "noindex");
  const nosnippet = hasDirective(combinedRobots, "nosnippet");
  const canonical = canonicalStatus(renderedPage.canonical ?? rawPage.canonical, finalUrl);

  const add = (input: FindingInput) => findings.push(finding(input));
  const base = (
    ruleId: string,
    pillar: Pillar,
    category: string,
    severity: Severity,
    weight: number,
    title: string,
    impact: string,
    recommendation: string,
    verification: string,
    sourceUrl: string,
    isPublic = false,
  ) => ({
    ruleId,
    pillar,
    category,
    severity,
    weight,
    title,
    impact,
    recommendation,
    verification,
    sourceUrl,
    public: isPublic,
  });

  add({
    ...base(
      "seo.http.reachable",
      "seo",
      "crawlability",
      "critical",
      10,
      "首頁可正常回應",
      "搜尋引擎與答案引擎必須先取得頁面，才能理解或引用內容。",
      "修復伺服器錯誤，讓正式 URL 穩定回傳 200–299。",
      "重新請求最終 URL 並確認 HTTP 狀態。",
      SOURCES.googleAi,
      true,
    ),
    state: fetch.status >= 200 && fetch.status < 300 ? "pass" : "fail",
    observed: `HTTP ${fetch.status}`,
  });

  add({
    ...base(
      "seo.http.redirect_chain",
      "seo",
      "crawlability",
      "high",
      4,
      "重新導向鏈簡潔",
      "過長的鏈會增加延遲與抓取失敗風險。",
      "直接連到最終 HTTPS canonical URL，移除不必要的中繼跳轉。",
      "從輸入 URL 重新追蹤整條 redirect chain。",
      SOURCES.googleAi,
      true,
    ),
    state: fetch.redirects.length <= 1 ? "pass" : fetch.redirects.length <= 3 ? "warn" : "fail",
    observed: `${fetch.redirects.length} 次重新導向`,
  });

  add({
    ...base(
      "seo.https.enabled",
      "seo",
      "security",
      "high",
      5,
      "使用 HTTPS",
      "HTTPS 是網站安全、信任與現代搜尋體驗的基礎。",
      "將所有正式流量導向有效的 HTTPS 網址。",
      "確認最終 URL 的 protocol 是 https。",
      SOURCES.googleAi,
    ),
    state: new URL(finalUrl).protocol === "https:" ? "pass" : "fail",
    observed: new URL(finalUrl).protocol.replace(":", "").toUpperCase(),
  });

  const googlePolicy = robots.policies.Googlebot;
  add({
    ...base(
      "seo.index.robots_allowed",
      "seo",
      "indexability",
      "critical",
      10,
      "Googlebot 可抓取",
      "阻擋 Googlebot 會讓頁面無法被正常發現與更新。",
      "調整 robots.txt，允許 Googlebot 存取此公開頁面。",
      "以 Googlebot user-agent 對最終 URL 計算 robots.txt 規則。",
      SOURCES.googleRobots,
      true,
    ),
    state: robots.found ? robotState(googlePolicy) : "pass",
    observed: robots.found ? robotObserved("Googlebot", googlePolicy) : "未找到 robots.txt；視為未阻擋",
  });

  add({
    ...base(
      "seo.index.meta_robots",
      "seo",
      "indexability",
      "critical",
      10,
      "頁面允許建立索引",
      "noindex 會直接排除搜尋索引，也會削弱多數 AI 搜尋的發現路徑。",
      "若此頁應公開，移除 HTML 或 HTTP header 中的 noindex。",
      "檢查 raw HTML、rendered DOM 與 X-Robots-Tag。",
      SOURCES.googleRobots,
      true,
    ),
    state: noindex ? "fail" : "pass",
    observed: noindex ? `偵測到 noindex：${combinedRobots}` : combinedRobots || "未偵測到 noindex",
  });

  add({
    ...base(
      "seo.index.canonical_present",
      "seo",
      "indexability",
      "medium",
      4,
      "Canonical 已宣告",
      "Canonical 幫助搜尋引擎辨識重複網址中的主要版本。",
      "在 head 中加入指向主要公開網址的 rel=canonical。",
      "查看 raw 與 rendered head 的 canonical link。",
      SOURCES.googleCanonical,
    ),
    state: renderedPage.canonical || rawPage.canonical ? "pass" : "fail",
    observed: renderedPage.canonical ?? rawPage.canonical ?? "未宣告",
  });

  add({
    ...base(
      "seo.index.canonical_valid",
      "seo",
      "indexability",
      "high",
      7,
      "Canonical 目標合理",
      "錯誤或跨站 canonical 可能把索引訊號交給別的網址。",
      "使用可解析、同站且可索引的正式 URL。",
      "解析 canonical 並與最終 URL 的 origin 比對。",
      SOURCES.googleCanonical,
      true,
    ),
    state: canonical.state,
    observed: canonical.observed,
  });

  const rawCritical = `${rawPage.canonical ?? ""}|${rawPage.metaRobots}`;
  const renderedCritical = `${renderedPage.canonical ?? ""}|${renderedPage.metaRobots}`;
  add({
    ...base(
      "seo.index.raw_rendered_consistency",
      "seo",
      "rendering",
      "high",
      6,
      "索引指令在渲染前後一致",
      "JavaScript 改寫 canonical 或 robots 會造成不確定的索引訊號。",
      "在初始 HTML 就輸出與最終 DOM 相同的 canonical 與 robots。",
      "比較 raw HTML 與瀏覽器 DOM 的 canonical/robots。",
      SOURCES.googleJavascript,
    ),
    state: render.succeeded ? (rawCritical === renderedCritical ? "pass" : "fail") : "unknown",
    observed: render.succeeded
      ? rawCritical === renderedCritical
        ? "關鍵索引指令一致"
        : `raw: ${rawCritical || "空"}；rendered: ${renderedCritical || "空"}`
      : "瀏覽器渲染不可用",
  });

  add({
    ...base(
      "seo.sitemap.discovered",
      "seo",
      "discovery",
      "medium",
      4,
      "可發現 Sitemap",
      "Sitemap 協助搜尋引擎發現重要且更新的 URL。",
      "提供 /sitemap.xml，並在 robots.txt 宣告其位置。",
      "檢查 robots.txt 宣告與標準 sitemap 路徑。",
      SOURCES.googleSitemap,
    ),
    state: sitemap.found ? "pass" : "fail",
    observed: sitemap.found ? sitemap.url ?? "已找到" : "未找到可用 sitemap",
  });

  add({
    ...base(
      "seo.sitemap.valid",
      "seo",
      "discovery",
      "high",
      5,
      "Sitemap 可解析",
      "格式錯誤的 sitemap 無法可靠傳達 URL 清單。",
      "輸出有效的 XML sitemap 或 sitemap index，且使用絕對 URL。",
      "以 XML parser 驗證已發現的 sitemap。",
      SOURCES.googleSitemap,
    ),
    state: !sitemap.found ? "unknown" : sitemap.valid ? "pass" : "fail",
    observed: !sitemap.found
      ? "沒有 sitemap 可驗證"
      : sitemap.valid
        ? `${sitemap.urlCount} 個 URL`
        : sitemap.error ?? "XML 無法解析",
  });

  add({
    ...base(
      "seo.page.title_present",
      "seo",
      "content",
      "high",
      6,
      "頁面標題存在",
      "Title 是搜尋結果與瀏覽器辨識頁面主題的重要訊號。",
      "加入唯一且描述性清楚的 title。",
      "讀取 rendered document title。",
      SOURCES.googleAi,
      true,
    ),
    state: renderedPage.title ? "pass" : "fail",
    observed: renderedPage.title || "空白 title",
  });

  const titleLength = renderedPage.title.length;
  add({
    ...base(
      "seo.page.title_quality",
      "seo",
      "content",
      "medium",
      3,
      "頁面標題具描述性",
      "過短、過長或泛稱標題不利於辨識頁面價值。",
      "用自然語言描述本頁主題與品牌，避免 Home、Untitled 等泛稱。",
      "檢查 title 長度與常見泛稱。",
      SOURCES.googleAi,
    ),
    state: !renderedPage.title
      ? "unknown"
      : /^(home|首頁|untitled|website)$/i.test(renderedPage.title) || titleLength < 12
        ? "fail"
        : titleLength > 70
          ? "warn"
          : "pass",
    observed: renderedPage.title ? `${titleLength} 字元：${renderedPage.title}` : "沒有 title",
    confidence: "medium",
  });

  add({
    ...base(
      "seo.page.description_present",
      "seo",
      "content",
      "low",
      2,
      "Meta description 存在",
      "描述可協助搜尋引擎與使用者快速理解頁面內容。",
      "撰寫與頁面一致、可獨立閱讀的摘要。",
      "讀取 meta[name=description]。",
      SOURCES.googleAi,
    ),
    state: renderedPage.description ? "pass" : "warn",
    observed: renderedPage.description || "未設定 meta description",
  });

  add({
    ...base(
      "seo.page.h1_present",
      "seo",
      "semantics",
      "medium",
      4,
      "主標題清楚",
      "明確的 H1 能快速傳達頁面的核心主題。",
      "加入一個描述頁面主題的主要 H1。",
      "計算 rendered DOM 中的 H1。",
      SOURCES.googleAi,
    ),
    state: renderedPage.h1.length === 1 ? "pass" : renderedPage.h1.length > 1 ? "warn" : "fail",
    observed: `${renderedPage.h1.length} 個 H1${renderedPage.h1[0] ? `：${renderedPage.h1[0]}` : ""}`,
  });

  add({
    ...base(
      "seo.page.heading_order",
      "seo",
      "semantics",
      "low",
      2,
      "標題層級連續",
      "一致的內容層級有助於人與機器理解章節關係。",
      "依 H1 → H2 → H3 的內容層級組織，避免跨兩級跳躍。",
      "依 DOM 順序檢查 heading level。",
      SOURCES.webA11y,
    ),
    state: headingHasSevereJump(renderedPage.headings.map((heading) => heading.level)) ? "warn" : "pass",
    observed: renderedPage.headings.length
      ? renderedPage.headings.map((heading) => `H${heading.level}`).join(" → ")
      : "沒有標題可評估",
    confidence: "medium",
  });

  add({
    ...base(
      "seo.page.text_available",
      "seo",
      "content",
      "high",
      7,
      "有足夠的可讀文字",
      "只有視覺元素或極少文字時，搜尋與答案引擎難以判斷頁面價值。",
      "提供可見、具體、符合使用者意圖的主要內容。",
      "計算 main/article/body 的可讀文字量。",
      SOURCES.googleAi,
      true,
    ),
    state: renderedPage.wordCount >= 180 ? "pass" : renderedPage.wordCount >= 70 ? "warn" : "fail",
    observed: `約 ${renderedPage.wordCount} 個詞彙單位`,
    confidence: "medium",
  });

  const rawRatio = renderedPage.wordCount
    ? rawPage.wordCount / Math.max(renderedPage.wordCount, 1)
    : 1;
  add({
    ...base(
      "seo.page.initial_html_content",
      "seo",
      "rendering",
      "high",
      6,
      "重要內容存在於初始 HTML",
      "完全依賴客戶端 JavaScript 會增加部分 crawler 取得空殼的風險。",
      "以 SSR、SSG 或可退化 HTML 輸出主要內容。",
      "比較 raw HTML 與 rendered DOM 的文字量。",
      SOURCES.googleJavascript,
    ),
    state: !render.succeeded ? "unknown" : rawRatio >= 0.65 ? "pass" : rawRatio >= 0.3 ? "warn" : "fail",
    observed: render.succeeded
      ? `初始 HTML 約含最終文字的 ${Math.round(rawRatio * 100)}%`
      : "瀏覽器渲染不可用",
  });

  add({
    ...base(
      "seo.page.viewport",
      "seo",
      "mobile",
      "medium",
      3,
      "行動版 Viewport 已設定",
      "缺少 viewport 會造成行動裝置閱讀與互動問題。",
      "加入 width=device-width, initial-scale=1。",
      "讀取 viewport meta。",
      SOURCES.googleAi,
    ),
    state: /width\s*=\s*device-width/i.test(renderedPage.viewport) ? "pass" : "fail",
    observed: renderedPage.viewport || "未設定 viewport",
  });

  const imageAltRatio = renderedPage.images.total
    ? 1 - renderedPage.images.missingAlt / renderedPage.images.total
    : 1;
  add({
    ...base(
      "seo.images.alt_coverage",
      "seo",
      "accessibility",
      "low",
      2,
      "圖片具替代文字",
      "Alt 能讓無法看見圖片的使用者與系統理解其功能。",
      "為有意義圖片提供描述性 alt；純裝飾圖使用空 alt。",
      "計算 img 是否具有 alt 屬性。",
      SOURCES.webA11y,
    ),
    state: imageAltRatio >= 0.95 ? "pass" : imageAltRatio >= 0.7 ? "warn" : "fail",
    observed: renderedPage.images.total
      ? `${renderedPage.images.missingAlt}/${renderedPage.images.total} 張缺少 alt`
      : "頁面沒有圖片",
  });

  const dimensionRatio = renderedPage.images.total
    ? 1 - renderedPage.images.missingDimensions / renderedPage.images.total
    : 1;
  add({
    ...base(
      "seo.images.dimensions",
      "seo",
      "performance",
      "low",
      2,
      "圖片保留版面尺寸",
      "明確尺寸可降低載入期間的版面位移。",
      "在 img 或 CSS aspect-ratio 提供穩定尺寸；本檢查只確認 HTML 屬性。",
      "計算具有 width 與 height 的 img。",
      SOURCES.googleCwv,
    ),
    state: dimensionRatio >= 0.9 ? "pass" : dimensionRatio >= 0.5 ? "warn" : "fail",
    observed: renderedPage.images.total
      ? `${renderedPage.images.missingDimensions}/${renderedPage.images.total} 張缺少 HTML 尺寸`
      : "頁面沒有圖片",
    confidence: "medium",
  });

  add({
    ...base(
      "seo.schema.parseable",
      "seo",
      "structured_data",
      "medium",
      4,
      "JSON-LD 可解析",
      "語法錯誤的結構化資料無法被可靠使用。",
      "修正 JSON 語法，並用官方測試工具驗證實際內容。",
      "解析所有 application/ld+json block。",
      SOURCES.googleStructuredData,
    ),
    state:
      renderedPage.jsonLd.blockCount === 0
        ? "not_applicable"
        : renderedPage.jsonLd.parseErrors === 0
          ? "pass"
          : "fail",
    observed:
      renderedPage.jsonLd.blockCount === 0
        ? "未偵測到 JSON-LD"
        : `${renderedPage.jsonLd.parseErrors}/${renderedPage.jsonLd.blockCount} 個 block 解析失敗`,
  });

  add({
    ...base(
      "seo.i18n.html_lang",
      "seo",
      "international",
      "medium",
      3,
      "文件語言已宣告",
      "語言標記幫助瀏覽器、輔助科技與系統選擇正確語言處理。",
      "在 html 元素設定有效的 BCP 47 lang。",
      "讀取 html[lang]。",
      SOURCES.webA11y,
    ),
    state: /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(renderedPage.htmlLang) ? "pass" : "fail",
    observed: renderedPage.htmlLang || "未設定 lang",
  });

  const firstParagraphLength = renderedPage.firstParagraph.length;
  add({
    ...base(
      "aeo.answer.direct_summary",
      "aeo",
      "answerability",
      "medium",
      7,
      "開頭提供直接摘要",
      "清楚的開場答案能降低理解成本，也更容易被抽取為答案片段。",
      "在主內容開頭用 1–3 句直接說明本頁主題、對象與價值。",
      "量測 main/article 的第一個段落。",
      SOURCES.googleAiFeatures,
      true,
    ),
    state:
      firstParagraphLength >= 70 && firstParagraphLength <= 500
        ? "pass"
        : firstParagraphLength >= 35
          ? "warn"
          : "fail",
    observed: renderedPage.firstParagraph
      ? `${firstParagraphLength} 字元：${renderedPage.firstParagraph.slice(0, 180)}`
      : "主內容沒有可辨識的第一段",
    confidence: "medium",
  });

  const descriptiveHeadings = renderedPage.headings.filter((heading) => heading.text.length >= 8);
  add({
    ...base(
      "aeo.structure.descriptive_headings",
      "aeo",
      "structure",
      "medium",
      5,
      "章節標題具有資訊",
      "描述性標題讓使用者與 agent 能快速定位可回答的段落。",
      "將模糊的「更多」「特色」改為能獨立理解的主題或問題。",
      "檢查 heading 是否非空且具足夠描述性。",
      SOURCES.googleAi,
    ),
    state:
      renderedPage.headings.length === 0
        ? "fail"
        : descriptiveHeadings.length / renderedPage.headings.length >= 0.75
          ? "pass"
          : "warn",
    observed: `${descriptiveHeadings.length}/${renderedPage.headings.length} 個標題具描述性`,
    confidence: "medium",
  });

  add({
    ...base(
      "aeo.structure.lists_tables",
      "aeo",
      "structure",
      "low",
      2,
      "內容使用可掃描結構",
      "清單與表格適合表達步驟、比較和並列資訊。",
      "若內容包含流程或比較，使用語意化 ol、ul 或 table。",
      "檢查 main/article 中的清單與表格。",
      SOURCES.googleAi,
    ),
    state: renderedPage.signals.hasList || renderedPage.signals.hasTable ? "pass" : "warn",
    observed: `${renderedPage.signals.hasList ? "有清單" : "無清單"}、${renderedPage.signals.hasTable ? "有表格" : "無表格"}`,
    confidence: "low",
  });

  add({
    ...base(
      "aeo.content.definition_clarity",
      "aeo",
      "answerability",
      "medium",
      5,
      "核心概念有明確定義",
      "實體與術語定義清楚，能減少答案引擎的語意歧義。",
      "首次出現核心名詞時，用一個完整句子明確定義。",
      "以開場段落中的定義語句作啟發式檢查。",
      SOURCES.googleAi,
    ),
    state: renderedPage.signals.hasDefinition ? "pass" : "warn",
    observed: renderedPage.signals.hasDefinition ? "開頭含定義型語句" : "開頭未偵測到清楚定義",
    confidence: "low",
  });

  add({
    ...base(
      "aeo.content.claim_attribution",
      "aeo",
      "evidence",
      "high",
      8,
      "內容具外部佐證路徑",
      "可追溯來源能提升讀者與答案系統對重要主張的信任。",
      "為數據、研究與產品主張連結至原始或權威來源。",
      "計算主要頁面中的外部 HTTP 連結；不判定來源品質。",
      SOURCES.googleAi,
      true,
    ),
    state: renderedPage.externalLinks.length >= 2 ? "pass" : renderedPage.externalLinks.length === 1 ? "warn" : "fail",
    observed: `${renderedPage.externalLinks.length} 個外部來源連結`,
    confidence: "medium",
  });

  add({
    ...base(
      "aeo.content.authorship",
      "aeo",
      "trust",
      "high",
      7,
      "責任作者或組織可辨識",
      "清楚責任歸屬有助於評估內容經驗、專業與可信度。",
      "顯示作者、審閱者或負責組織，並連到可驗證介紹。",
      "檢查 author markup、byline 與 Organization schema。",
      SOURCES.googleAi,
      true,
    ),
    state:
      renderedPage.signals.hasAuthor || renderedPage.jsonLd.organizationNames.length > 0
        ? "pass"
        : "fail",
    observed: renderedPage.signals.hasAuthor
      ? "頁面具有作者訊號"
      : renderedPage.jsonLd.organizationNames.length
        ? `組織：${renderedPage.jsonLd.organizationNames.join(", ")}`
        : "未找到作者或負責組織",
  });

  add({
    ...base(
      "aeo.content.freshness",
      "aeo",
      "trust",
      "medium",
      4,
      "內容日期可辨識",
      "對會變動的主題，日期能讓讀者判斷資訊是否仍適用。",
      "在文章或研究頁顯示發布與最後更新日期。",
      "檢查 time 與文章日期 metadata。",
      SOURCES.googleAi,
    ),
    state:
      renderedPage.signals.hasPublishedDate || renderedPage.signals.hasModifiedDate ? "pass" : "warn",
    observed: `${renderedPage.signals.hasPublishedDate ? "有發布日期" : "無發布日期"}、${renderedPage.signals.hasModifiedDate ? "有更新日期" : "無更新日期"}`,
    confidence: "medium",
  });

  add({
    ...base(
      "aeo.entity.organization",
      "aeo",
      "entity",
      "medium",
      6,
      "組織實體清楚",
      "一致的品牌名稱與組織資料能降低實體辨識歧義。",
      "加入與頁面可見品牌一致的 Organization 結構化資料。",
      "檢查 Organization/Corporation/LocalBusiness JSON-LD。",
      SOURCES.schema,
    ),
    state: renderedPage.jsonLd.organizationNames.length > 0 ? "pass" : "warn",
    observed: renderedPage.jsonLd.organizationNames.length
      ? renderedPage.jsonLd.organizationNames.join(", ")
      : "未偵測到具名稱的 Organization schema",
  });

  add({
    ...base(
      "aeo.agent.semantic_landmarks",
      "aeo",
      "agent_access",
      "medium",
      5,
      "主要區域具語意結構",
      "main、nav、article 等區域有助於 agent 分辨內容與介面。",
      "使用 main、nav、header、footer 等原生 HTML landmark。",
      "檢查 rendered DOM 的語意 landmark。",
      SOURCES.webA11y,
    ),
    state:
      renderedPage.landmarks.includes("main") && renderedPage.landmarks.includes("nav")
        ? "pass"
        : renderedPage.landmarks.includes("main")
          ? "warn"
          : "fail",
    observed: renderedPage.landmarks.length ? renderedPage.landmarks.join(", ") : "未找到語意 landmark",
  });

  const unnamedRatio = renderedPage.interactiveControls.total
    ? renderedPage.interactiveControls.unnamed / renderedPage.interactiveControls.total
    : 0;
  add({
    ...base(
      "aeo.agent.named_controls",
      "aeo",
      "agent_access",
      "medium",
      5,
      "互動控制項有名稱",
      "未命名按鈕或輸入欄讓輔助科技與 browser agent 無法可靠操作。",
      "加入可見文字或正確 aria-label，並以 accessibility tree 驗證。",
      "以文字、aria-label、title、value 等近似 accessible name。",
      SOURCES.webA11y,
    ),
    state: unnamedRatio === 0 ? "pass" : unnamedRatio <= 0.1 ? "warn" : "fail",
    observed: `${renderedPage.interactiveControls.unnamed}/${renderedPage.interactiveControls.total} 個控制項未命名`,
  });

  const searchEligible =
    fetch.status >= 200 && fetch.status < 300 && googlePolicy !== false && !noindex;
  add({
    ...base(
      "geo.google.search_eligibility",
      "geo",
      "discovery",
      "critical",
      10,
      "具備 Google 搜尋與 AI 功能基本資格",
      "Google 的 AI 搜尋功能仍以可索引、可顯示摘要的搜尋資格為基礎。",
      "先修復 HTTP、Googlebot robots 與 noindex 等基本阻擋。",
      "組合 HTTP、robots 與 meta/header robots 證據。",
      SOURCES.googleAiFeatures,
      true,
    ),
    state: searchEligible && !nosnippet ? "pass" : searchEligible ? "warn" : "fail",
    observed: !searchEligible
      ? "頁面目前不符合基本搜尋資格"
      : nosnippet
        ? "可索引，但 nosnippet 限制摘要"
        : "可抓取、可索引且未禁止摘要",
  });

  const crawlerRule = (
    ruleId: string,
    title: string,
    agent: string,
    sourceUrl: string,
    isPublic: boolean,
    severity: Severity = "high",
    weight = 7,
    informational = false,
  ) => {
    const policy = robots.policies[agent];
    add({
      ...base(
        ruleId,
        "geo",
        "crawler_access",
        severity,
        informational ? 0 : weight,
        title,
        "對應搜尋或使用者觸發 crawler 被阻擋時，該平台取得內容的路徑會受限。",
        `依你的內容政策確認是否允許 ${agent}；搜尋與訓練 crawler 不應混為一談。`,
        `以 ${agent} user-agent 計算 robots.txt 對最終 URL 的規則。`,
        sourceUrl,
        isPublic,
      ),
      state: robots.found ? robotState(policy) : "pass",
      observed: robots.found ? robotObserved(agent, policy) : "未找到 robots.txt；視為未阻擋",
      informational,
    });
  };

  crawlerRule(
    "geo.openai.searchbot_access",
    "OAI-SearchBot 可存取",
    "OAI-SearchBot",
    SOURCES.openAiCrawler,
    true,
  );
  crawlerRule(
    "geo.openai.user_access",
    "ChatGPT-User 存取政策",
    "ChatGPT-User",
    SOURCES.openAiCrawler,
    false,
    "info",
    0,
    true,
  );
  crawlerRule(
    "geo.anthropic.searchbot_access",
    "Claude-SearchBot 可存取",
    "Claude-SearchBot",
    SOURCES.anthropicCrawler,
    true,
  );
  crawlerRule(
    "geo.anthropic.user_access",
    "Claude-User 可存取",
    "Claude-User",
    SOURCES.anthropicCrawler,
    false,
    "medium",
    4,
  );
  crawlerRule(
    "geo.perplexity.searchbot_access",
    "PerplexityBot 可存取",
    "PerplexityBot",
    SOURCES.perplexityCrawler,
    true,
  );
  crawlerRule(
    "geo.bing.search_access",
    "Bingbot 可存取",
    "Bingbot",
    SOURCES.bingCrawler,
    false,
  );

  add({
    ...base(
      "geo.content.server_accessible",
      "geo",
      "content_access",
      "high",
      8,
      "主要內容不依賴脆弱的客戶端渲染",
      "不同 AI crawler 的渲染能力與排程不同；初始 HTML 越完整越可靠。",
      "以 SSR/SSG 提供主要文字、連結與 metadata。",
      "比較 raw 與 rendered 文字量。",
      SOURCES.googleJavascript,
      true,
    ),
    state: !render.succeeded ? "unknown" : rawRatio >= 0.65 ? "pass" : rawRatio >= 0.3 ? "warn" : "fail",
    observed: render.succeeded ? `初始 HTML 文字覆蓋 ${Math.round(rawRatio * 100)}%` : "無渲染證據",
  });

  add({
    ...base(
      "geo.content.citable_evidence",
      "geo",
      "citability",
      "high",
      8,
      "內容具可引用證據",
      "清楚主張、來源與責任實體能增加內容被安全引用的可能性，但不保證曝光。",
      "補上可驗證來源、作者/組織與清晰答案段落。",
      "組合外部來源、作者與直接摘要訊號。",
      SOURCES.googleAi,
    ),
    state:
      renderedPage.externalLinks.length >= 2 &&
      (renderedPage.signals.hasAuthor || renderedPage.jsonLd.organizationNames.length > 0) &&
      firstParagraphLength >= 70
        ? "pass"
        : renderedPage.externalLinks.length >= 1
          ? "warn"
          : "fail",
    observed: `${renderedPage.externalLinks.length} 個來源；${renderedPage.signals.hasAuthor ? "有作者" : "未見作者"}；開頭 ${firstParagraphLength} 字元`,
    confidence: "medium",
  });

  add({
    ...base(
      "geo.entity.brand_consistency",
      "geo",
      "entity",
      "medium",
      5,
      "品牌實體訊號一致",
      "一致的可見品牌與 Organization 資料有助於實體解析。",
      "讓 title、頁面品牌名稱與 Organization schema 使用相同正式名稱。",
      "比較 Organization schema 名稱是否出現在可見文字或 title。",
      SOURCES.schema,
    ),
    state:
      renderedPage.jsonLd.organizationNames.length === 0
        ? "warn"
        : renderedPage.jsonLd.organizationNames.some((name) =>
              `${renderedPage.title} ${renderedPage.text}`.toLowerCase().includes(name.toLowerCase()),
            )
          ? "pass"
          : "fail",
    observed: renderedPage.jsonLd.organizationNames.length
      ? renderedPage.jsonLd.organizationNames.join(", ")
      : "沒有 Organization 名稱可交叉驗證",
    confidence: "medium",
  });

  add({
    ...base(
      "geo.snippet.controls",
      "geo",
      "content_controls",
      "high",
      6,
      "摘要控制不限制內容使用",
      "nosnippet 或過度嚴格的摘要限制會影響搜尋結果及部分 AI 搜尋呈現。",
      "若希望內容可被摘要，移除 nosnippet 並檢視 max-snippet 政策。",
      "檢查 meta robots 與 X-Robots-Tag。",
      SOURCES.googleRobots,
    ),
    state: nosnippet ? "fail" : /max-snippet\s*:\s*0/i.test(combinedRobots) ? "fail" : "pass",
    observed: combinedRobots || "未偵測到摘要限制",
  });

  add({
    ...base(
      "geo.llms_txt.status",
      "geo",
      "experimental",
      "info",
      0,
      "llms.txt 狀態（不計分）",
      "llms.txt 是新興慣例，尚不應被當成排名或引用保證。",
      "可選擇提供，但不要取代 robots、sitemap、metadata 與可引用內容。",
      "請求 /llms.txt 並進行最小格式檢查。",
      "https://llmstxt.org/",
    ),
    state: llmsTxt.found ? (llmsTxt.valid ? "pass" : "warn") : "not_applicable",
    observed: llmsTxt.found ? (llmsTxt.valid ? "已找到且格式可讀" : "已找到但格式可疑") : "未提供（不扣分）",
    informational: true,
  });

  const trainingAgents = [
    ["GPTBot", SOURCES.openAiCrawler],
    ["ClaudeBot", SOURCES.anthropicCrawler],
    ["Google-Extended", SOURCES.googleAi],
    ["CCBot", "https://commoncrawl.org/ccbot"],
  ] as const;
  trainingAgents.forEach(([agent, sourceUrl]) => {
    const policy = robots.policies[agent];
    add({
      ...base(
        `geo.training.${agent.toLowerCase().replace(/[^a-z]+/g, "_")}`,
        "geo",
        "training_policy",
        "info",
        0,
        `${agent} 訓練/擴充政策（不計分）`,
        "訓練 crawler 的政策不等同搜尋或使用者觸發存取。",
        "依內容授權政策設定；允許或阻擋都不影響本工具分數。",
        `以 ${agent} 計算 robots.txt 規則。`,
        sourceUrl,
      ),
      state: robots.found ? robotState(policy) : "pass",
      observed: robots.found ? robotObserved(agent, policy) : "未找到 robots.txt；視為未阻擋",
      informational: true,
    });
  });

  const trustRule = (
    id: string,
    title: string,
    state: RuleState,
    observed: string,
    recommendation: string,
    severity: Severity,
    weight: number,
  ) =>
    add({
      ...base(
        id,
        "trust",
        "business_trust",
        severity,
        weight,
        title,
        "清楚的責任與政策路徑能降低使用者和系統評估網站可信度的成本。",
        recommendation,
        "檢查頁面可見連結文字與目的地。",
        SOURCES.googleAi,
      ),
      state,
      observed,
    });

  trustRule(
    "trust.contact.visible",
    "可找到聯絡方式",
    renderedPage.signals.hasContactLink ? "pass" : "fail",
    renderedPage.signals.hasContactLink ? "有聯絡入口" : "未找到聯絡入口",
    "在全站導覽或頁尾加入清楚的聯絡方式。",
    "medium",
    5,
  );
  trustRule(
    "trust.legal.privacy",
    "可找到隱私政策",
    renderedPage.signals.hasPrivacyLink ? "pass" : "fail",
    renderedPage.signals.hasPrivacyLink ? "有隱私政策入口" : "未找到隱私政策入口",
    "提供容易找到的隱私政策，說明資料用途與權利。",
    "medium",
    5,
  );
  trustRule(
    "trust.legal.terms",
    "可找到使用條款",
    renderedPage.signals.hasTermsLink ? "pass" : "warn",
    renderedPage.signals.hasTermsLink ? "有條款入口" : "未找到使用條款入口",
    "若提供服務或蒐集 leads，加入適用的服務/使用條款。",
    "low",
    3,
  );
  trustRule(
    "trust.security.https",
    "信任頁面使用 HTTPS",
    new URL(finalUrl).protocol === "https:" ? "pass" : "fail",
    new URL(finalUrl).protocol === "https:" ? "HTTPS" : "HTTP",
    "將公開網站與表單完整切換至 HTTPS。",
    "high",
    7,
  );

  return findings;
}
