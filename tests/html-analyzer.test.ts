import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { analyzeHtml } from "@/lib/audit/html-analyzer";

const fixture = fileURLToPath(new URL("./fixtures/healthy.html", import.meta.url));

describe("HTML analyzer", () => {
  it("extracts visible, semantic, entity and trust evidence", async () => {
    const page = analyzeHtml(await readFile(fixture, "utf8"), "https://example.com/");
    expect(page.title).toContain("Tenten GEO");
    expect(page.h1).toEqual(["什麼是生成式引擎最佳化？"]);
    expect(page.wordCount).toBeGreaterThan(100);
    expect(page.externalLinks).toHaveLength(2);
    expect(page.jsonLd.organizationNames).toEqual(["Tenten"]);
    expect(page.jsonLd.parseErrors).toBe(0);
    expect(page.signals).toMatchObject({
      hasAuthor: true,
      hasPublishedDate: true,
      hasDefinition: true,
      hasQuestionHeading: true,
      hasContactLink: true,
      hasPrivacyLink: true,
      hasTermsLink: true,
    });
    expect(page.interactiveControls.unnamed).toBe(0);
  });
});
