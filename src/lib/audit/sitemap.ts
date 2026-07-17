import { XMLParser } from "fast-xml-parser";

import type { SitemapEvidence } from "./types";
import { safeFetchText } from "./safe-fetch";

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export async function collectSitemap(
  pageUrl: string,
  declaredUrls: string[],
): Promise<SitemapEvidence> {
  const candidates = [...new Set([...declaredUrls, new URL("/sitemap.xml", pageUrl).toString()])];

  for (const candidate of candidates.slice(0, 3)) {
    try {
      const response = await safeFetchText(candidate, { maxBytes: 2_000_000 });
      if (response.status < 200 || response.status >= 300 || !response.body.trim()) continue;

      const parsed = new XMLParser({ ignoreAttributes: false }).parse(response.body) as {
        urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
        sitemapindex?: { sitemap?: Array<{ loc?: string }> | { loc?: string } };
      };

      const pageUrls = asArray(parsed.urlset?.url)
        .map((entry) => entry.loc)
        .filter((value): value is string => typeof value === "string");
      const childSitemaps = asArray(parsed.sitemapindex?.sitemap)
        .map((entry) => entry.loc)
        .filter((value): value is string => typeof value === "string");
      const urls = pageUrls.length ? pageUrls : childSitemaps;

      return {
        found: true,
        valid: Boolean(parsed.urlset || parsed.sitemapindex) && urls.length > 0,
        url: response.finalUrl,
        urlCount: urls.length,
        sampleUrls: urls.slice(0, 10),
        error: null,
      };
    } catch (error) {
      return {
        found: true,
        valid: false,
        url: candidate,
        urlCount: 0,
        sampleUrls: [],
        error: error instanceof Error ? error.message : "Sitemap 無法解析",
      };
    }
  }

  return {
    found: false,
    valid: false,
    url: null,
    urlCount: 0,
    sampleUrls: [],
    error: null,
  };
}
