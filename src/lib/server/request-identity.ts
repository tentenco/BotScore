import "server-only";

function validAddress(value: string | null) {
  const candidate = value?.split(",")[0]?.trim();
  return candidate && candidate.length <= 64 ? candidate : null;
}

export function requestIdentity(request: Request) {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "untrusted-client";

  if (process.env.TRUST_CLOUDFLARE_HEADERS === "true") {
    const cloudflare = validAddress(request.headers.get("cf-connecting-ip"));
    if (cloudflare) return cloudflare;
  }

  return (
    validAddress(request.headers.get("x-forwarded-for")) ||
    validAddress(request.headers.get("x-real-ip")) ||
    "proxy-unknown"
  );
}
