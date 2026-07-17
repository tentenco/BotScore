import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export class UrlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlSafetyError";
  }
}

export interface ResolvedTarget {
  url: URL;
  addresses: Array<{ address: string; family: 4 | 6 }>;
}

export type AddressResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: AddressResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export function isPublicAddress(value: string): boolean {
  let address = ipaddr.parse(value);
  if (address.kind() === "ipv6") {
    const ipv6 = address as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) address = ipv6.toIPv4Address();
  }
  return address.range() === "unicast";
}

export function normalizeHttpUrl(input: string): URL {
  const candidate = input.trim();
  if (!candidate) {
    throw new UrlSafetyError("請輸入網站網址");
  }

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new UrlSafetyError("網址格式無法辨識");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UrlSafetyError("只允許 http 或 https 網址");
  }
  if (url.username || url.password) {
    throw new UrlSafetyError("網址不可包含帳號或密碼");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new UrlSafetyError("只允許標準 HTTP/HTTPS 連接埠");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new UrlSafetyError("不可檢測本機或私人網路位址");
  }

  url.hash = "";
  return url;
}

export async function validatePublicUrl(
  input: string | URL,
  resolver: AddressResolver = defaultResolver,
): Promise<ResolvedTarget> {
  const url = input instanceof URL ? normalizeHttpUrl(input.toString()) : normalizeHttpUrl(input);

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await resolver(url.hostname);
  } catch {
    throw new UrlSafetyError("網域名稱目前無法解析");
  }

  if (resolved.length === 0) {
    throw new UrlSafetyError("網域沒有可用的公開 IP 位址");
  }

  const addresses = resolved.map(({ address, family }) => {
    if (!isPublicAddress(address)) {
      throw new UrlSafetyError("不可檢測本機、私人、保留或雲端中繼資料位址");
    }
    if (family !== 4 && family !== 6) {
      throw new UrlSafetyError("網域解析出不支援的位址格式");
    }
    return { address, family } as { address: string; family: 4 | 6 };
  });

  return { url, addresses };
}
