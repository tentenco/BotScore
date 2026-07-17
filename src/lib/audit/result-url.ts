const LEADING_WWW = /^www\./i;

export function canonicalHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, "").replace(LEADING_WWW, "");
}

export function resultPathForUrl(input: string | URL) {
  const url = input instanceof URL ? input : new URL(input);
  return `/${encodeURIComponent(canonicalHostname(url.hostname))}`;
}

export function parseResultHostname(segment: string) {
  let decoded: string;

  try {
    decoded = decodeURIComponent(segment).trim().toLowerCase();
  } catch {
    return null;
  }

  if (
    !decoded ||
    decoded.length > 253 ||
    decoded.includes("/") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    decoded.includes("@")
  ) {
    return null;
  }

  try {
    const url = new URL(`https://${decoded}`);
    if (url.port || url.pathname !== "/" || !url.hostname.includes(".")) return null;
    return canonicalHostname(url.hostname);
  } catch {
    return null;
  }
}
