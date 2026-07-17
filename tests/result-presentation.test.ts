import { describe, expect, it } from "vitest";

import { canonicalHostname, parseResultHostname, resultPathForUrl } from "../src/lib/audit/result-url";
import { getScorePresentation } from "../src/lib/audit/score-presentation";

describe("shareable result URLs", () => {
  it("turns the scanned host into a clean canonical route", () => {
    expect(resultPathForUrl("https://www.TENTEN.co/insights/article?utm_source=test")).toBe("/tenten.co");
    expect(canonicalHostname("WWW.Example.com.")).toBe("example.com");
  });

  it("accepts public-looking domain segments and rejects route-shaped input", () => {
    expect(parseResultHostname("TENTEN.co")).toBe("tenten.co");
    expect(parseResultHostname("www.tentencommerce.com")).toBe("tentencommerce.com");
    expect(parseResultHostname("audit/example.com")).toBeNull();
    expect(parseResultHostname("localhost")).toBeNull();
  });
});

describe("score presentation", () => {
  it("maps scores to stable, readable levels", () => {
    expect(getScorePresentation(94)).toMatchObject({ level: 5, tone: "strong" });
    expect(getScorePresentation(75)).toMatchObject({ level: 4, tone: "good" });
    expect(getScorePresentation(64)).toMatchObject({ level: 3, tone: "watch" });
    expect(getScorePresentation(39)).toMatchObject({ level: 1, tone: "critical" });
    expect(getScorePresentation(null)).toMatchObject({ level: null, tone: "unknown" });
  });
});
