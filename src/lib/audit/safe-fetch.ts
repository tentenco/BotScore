import { Agent, request } from "undici";

import type { FetchEvidence, RedirectHop } from "./types";
import { UrlSafetyError, validatePublicUrl } from "./url-safety";

const USER_AGENT =
  "BotScore/0.1 (+https://github.com/tentenco/BotScore; public-site-audit)";

const MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = Number(process.env.AUDIT_MAX_RESPONSE_BYTES ?? 2_097_152);
const DEFAULT_TIMEOUT_MS = Number(process.env.AUDIT_FETCH_TIMEOUT_MS ?? 15_000);

function headersToRecord(headers: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(", ") : value ?? "",
    ]),
  );
}

async function readBody(body: AsyncIterable<Uint8Array>, maxBytes: number) {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maxBytes) {
      throw new Error(`回應內容超過 ${Math.round(maxBytes / 1024 / 1024)} MB 上限`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function safeFetchText(
  input: string,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchEvidence> {
  const startedAt = performance.now();
  const redirects: RedirectHop[] = [];
  let current = input;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = await validatePublicUrl(current);
    const pinned = target.addresses[0];
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, lookupOptions, callback) => {
          if (typeof lookupOptions === "object" && lookupOptions.all) {
            callback(null, [{ address: pinned.address, family: pinned.family }]);
            return;
          }
          callback(null, pinned.address, pinned.family);
        },
      },
    });

    try {
      const response = await request(target.url, {
        dispatcher,
        method: "GET",
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.1",
          "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
      });

      const headers = headersToRecord(response.headers);
      const location = headers.location;

      if (response.statusCode >= 300 && response.statusCode < 400 && location) {
        if (hop === MAX_REDIRECTS) {
          throw new Error("重新導向次數超過安全上限");
        }
        const next = new URL(location, target.url).toString();
        redirects.push({
          url: target.url.toString(),
          status: response.statusCode,
          location: next,
        });
        response.body.destroy();
        current = next;
        continue;
      }

      const body = await readBody(response.body, maxBytes);
      return {
        requestedUrl: input,
        finalUrl: target.url.toString(),
        status: response.statusCode,
        headers,
        body,
        redirects,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      if (error instanceof UrlSafetyError) throw error;
      throw new Error(error instanceof Error ? error.message : "網站擷取失敗");
    } finally {
      await dispatcher.close();
    }
  }

  throw new Error("網站重新導向無法完成");
}
