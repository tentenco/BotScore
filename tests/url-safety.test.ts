import { describe, expect, it } from "vitest";

import { isPublicAddress, normalizeHttpUrl, validatePublicUrl } from "@/lib/audit/url-safety";

describe("URL safety", () => {
  it("normalizes a domain to https", () => {
    expect(normalizeHttpUrl("example.com/path#section").toString()).toBe("https://example.com/path");
  });

  it.each(["127.0.0.1", "10.0.0.8", "169.254.169.254", "::1", "::ffff:10.0.0.1"])(
    "rejects non-public address %s",
    (address) => expect(isPublicAddress(address)).toBe(false),
  );

  it("accepts public unicast addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it("rejects a hostname if any resolved address is private", async () => {
    await expect(
      validatePublicUrl("https://example.com", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.2", family: 4 },
      ]),
    ).rejects.toThrow(/私人|保留/);
  });
});
