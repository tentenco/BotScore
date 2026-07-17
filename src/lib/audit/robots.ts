import robotsParser from "robots-parser";

import type { RobotsEvidence } from "./types";
import { safeFetchText } from "./safe-fetch";

export const CRAWLER_AGENTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
] as const;

export async function collectRobots(pageUrl: string): Promise<RobotsEvidence> {
  const robotsUrl = new URL("/robots.txt", pageUrl).toString();
  try {
    const response = await safeFetchText(robotsUrl, { maxBytes: 512_000 });
    if (response.status < 200 || response.status >= 300) {
      return { found: false, body: "", sitemapUrls: [], policies: {} };
    }
    const parser = robotsParser(robotsUrl, response.body);
    const policies = Object.fromEntries(
      CRAWLER_AGENTS.map((agent) => {
        const allowed = parser.isAllowed(pageUrl, agent);
        return [agent, allowed === undefined ? null : allowed];
      }),
    );
    const sitemapUrls = response.body
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*Sitemap\s*:\s*(.+)\s*$/i)?.[1]?.trim())
      .filter((value): value is string => Boolean(value));

    return { found: true, body: response.body, sitemapUrls, policies };
  } catch {
    return { found: false, body: "", sitemapUrls: [], policies: {} };
  }
}
