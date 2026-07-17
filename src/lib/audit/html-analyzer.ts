import * as cheerio from "cheerio";

import type { PageEvidence } from "./types";

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(value: string) {
  const latinWords = value.match(/[A-Za-zÀ-ž0-9]+(?:['’-][A-Za-zÀ-ž0-9]+)*/g)?.length ?? 0;
  const cjkCharacters = value.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  return latinWords + Math.ceil(cjkCharacters / 2);
}

function schemaItems(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input.flatMap(schemaItems);
  }
  if (!input || typeof input !== "object") return [];
  const record = input as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) {
    return schemaItems(record["@graph"]);
  }
  return [record];
}

export function analyzeHtml(html: string, baseUrl: string): PageEvidence {
  const $ = cheerio.load(html || "");
  const base = new URL(baseUrl);

  const textRoot = $("main").first().length
    ? $("main").first().clone()
    : $("article").first().length
      ? $("article").first().clone()
      : $("body").first().clone();
  textRoot.find("script,style,noscript,svg,template").remove();
  const text = compact(textRoot.text());

  const firstParagraph = compact(
    ($("main p").first().text() || $("article p").first().text() || $("body p").first().text()),
  );

  const headings = $("h1,h2,h3,h4,h5,h6")
    .toArray()
    .map((element) => ({
      level: Number(element.tagName.slice(1)),
      text: compact($(element).text()),
    }))
    .filter((heading) => heading.text.length > 0);

  const internalLinks = new Set<string>();
  const externalLinks = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    try {
      const url = new URL(href, base);
      url.hash = "";
      if (url.origin === base.origin) internalLinks.add(url.toString());
      else if (["http:", "https:"].includes(url.protocol)) externalLinks.add(url.toString());
    } catch {
      // Malformed links are evaluated by a separate crawler in a later phase.
    }
  });

  let missingAlt = 0;
  let missingDimensions = 0;
  const images = $("img").toArray();
  images.forEach((element) => {
    const image = $(element);
    if (image.attr("alt") === undefined) missingAlt += 1;
    if (!image.attr("width") || !image.attr("height")) missingDimensions += 1;
  });

  const schemaTypes = new Set<string>();
  const organizationNames = new Set<string>();
  let blockCount = 0;
  let parseErrors = 0;
  $('script[type="application/ld+json"]').each((_index, element) => {
    const value = $(element).html()?.trim();
    if (!value) return;
    blockCount += 1;
    try {
      for (const item of schemaItems(JSON.parse(value) as unknown)) {
        const type = item["@type"];
        const types = Array.isArray(type) ? type : [type];
        types.filter((entry): entry is string => typeof entry === "string").forEach((entry) => {
          schemaTypes.add(entry);
          if (/^(Organization|Corporation|LocalBusiness)$/i.test(entry)) {
            const name = item.name;
            if (typeof name === "string" && name.trim()) organizationNames.add(name.trim());
          }
        });
      }
    } catch {
      parseErrors += 1;
    }
  });

  const controls = $(
    'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="link"]',
  ).toArray();
  let unnamedControls = 0;
  controls.forEach((element) => {
    const node = $(element);
    const name = compact(
      node.attr("aria-label") ||
        node.attr("title") ||
        node.attr("alt") ||
        node.attr("value") ||
        node.text(),
    );
    if (!name) unnamedControls += 1;
  });

  const hrefLang = $('link[rel~="alternate"][hreflang]')
    .toArray()
    .map((element) => ({
      lang: compact($(element).attr("hreflang") ?? ""),
      href: compact($(element).attr("href") ?? ""),
    }))
    .filter((entry) => entry.lang && entry.href);

  const bodyText = compact($("body").text());
  const lowerBody = bodyText.toLowerCase();
  const linkSnapshot = $("a[href]")
    .toArray()
    .map((element) => `${$(element).attr("href") ?? ""} ${compact($(element).text())}`)
    .join(" ")
    .toLowerCase();

  const landmarks = ["header", "nav", "main", "article", "aside", "footer"].filter(
    (name) => $(name).length > 0,
  );

  return {
    title: compact($("title").first().text()),
    description: compact($('meta[name="description"]').first().attr("content") ?? ""),
    canonical: $('link[rel="canonical"]').first().attr("href")?.trim() || null,
    metaRobots: compact(
      [
        $('meta[name="robots"]').attr("content"),
        $('meta[name="googlebot"]').attr("content"),
      ]
        .filter(Boolean)
        .join(", "),
    ).toLowerCase(),
    htmlLang: compact($("html").attr("lang") ?? ""),
    viewport: compact($('meta[name="viewport"]').attr("content") ?? ""),
    h1: $("h1")
      .toArray()
      .map((element) => compact($(element).text()))
      .filter(Boolean),
    headings,
    text,
    wordCount: countWords(text),
    firstParagraph,
    internalLinks: [...internalLinks],
    externalLinks: [...externalLinks],
    images: {
      total: images.length,
      missingAlt,
      missingDimensions,
    },
    jsonLd: {
      blockCount,
      parseErrors,
      types: [...schemaTypes],
      organizationNames: [...organizationNames],
    },
    hreflang: hrefLang,
    landmarks,
    interactiveControls: {
      total: controls.length,
      unnamed: unnamedControls,
    },
    signals: {
      hasAuthor:
        $('[rel="author"],[itemprop="author"],.author,.byline,[class*="author-"]').length > 0 ||
        /\b(by|author|written by)\s+[\p{L}]/iu.test(bodyText) ||
        /作者[：:]?\s*[\p{L}]/u.test(bodyText),
      hasPublishedDate:
        $('time[datetime],meta[property="article:published_time"],meta[name="date"]').length > 0,
      hasModifiedDate:
        $('meta[property="article:modified_time"],time[itemprop="dateModified"],meta[itemprop="dateModified"]').length > 0 ||
        /(last updated|updated on|最後更新|更新日期)/i.test(lowerBody),
      hasDefinition:
        /\b(is|are|refers to|means)\b/i.test(firstParagraph) ||
        /(是指|指的是|意思是|定義為)/.test(firstParagraph),
      hasQuestionHeading: headings.some((heading) =>
        /(\?|？|^(what|why|how|when|where|who|can|does|do|is|are)\b|^(什麼|為什麼|如何|怎麼|是否|哪裡|誰))/i.test(
          heading.text,
        ),
      ),
      hasList: $("main ul,main ol,article ul,article ol").length > 0,
      hasTable: $("main table,article table").length > 0,
      hasContactLink: /(contact|聯絡|聯繫|洽詢)/i.test(linkSnapshot),
      hasPrivacyLink: /(privacy|隱私)/i.test(linkSnapshot),
      hasTermsLink: /(terms|條款|使用規範)/i.test(linkSnapshot),
    },
  };
}
