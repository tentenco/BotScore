import { access } from "node:fs/promises";

import { chromium } from "playwright-core";

import type { RenderEvidence } from "./types";
import { validatePublicUrl } from "./url-safety";

const COMMON_EXECUTABLES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function findExecutable() {
  const candidates = [process.env.CHROME_EXECUTABLE_PATH, ...COMMON_EXECUTABLES].filter(
    (value): value is string => Boolean(value),
  );
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser location.
    }
  }
  return null;
}

export async function renderPage(url: string): Promise<RenderEvidence> {
  const executablePath = await findExecutable();
  if (!executablePath) {
    return {
      attempted: false,
      succeeded: false,
      html: "",
      error: "找不到可用的 Chrome/Chromium，已使用原始 HTML 分析",
    };
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-background-networking"],
  });
  const context = await browser.newContext({
    userAgent: "BotScore/0.1 (+https://github.com/tentenco/BotScore; rendered-audit)",
    viewport: { width: 1440, height: 1000 },
    javaScriptEnabled: true,
  });
  const page = await context.newPage();
  const validationCache = new Map<string, Promise<boolean>>();

  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (/^(data:|blob:|about:)/i.test(requestUrl)) {
      await route.continue();
      return;
    }

    let origin: string;
    try {
      origin = new URL(requestUrl).origin;
    } catch {
      await route.abort("blockedbyclient");
      return;
    }

    const allowed =
      validationCache.get(origin) ??
      validatePublicUrl(requestUrl)
        .then(() => true)
        .catch(() => false);
    validationCache.set(origin, allowed);

    if (await allowed) await route.continue();
    else await route.abort("blockedbyclient");
  });

  try {
    const timeout = Number(process.env.AUDIT_RENDER_TIMEOUT_MS ?? 20_000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    await page.waitForTimeout(800);
    return {
      attempted: true,
      succeeded: true,
      html: await page.content(),
      error: null,
    };
  } catch (error) {
    return {
      attempted: true,
      succeeded: false,
      html: "",
      error: error instanceof Error ? error.message : "瀏覽器渲染失敗",
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
