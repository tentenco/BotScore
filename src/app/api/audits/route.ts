import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeHttpUrl } from "@/lib/audit/url-safety";
import { resultPathForUrl } from "@/lib/audit/result-url";
import { enqueueAudit } from "@/lib/server/audit-jobs";
import { consumeRateLimit, createOrReuseAudit, failAudit } from "@/lib/server/database";
import { requestIdentity } from "@/lib/server/request-identity";

export const runtime = "nodejs";

const RequestSchema = z.object({ url: z.string().trim().min(1).max(2_000) });

export async function POST(request: Request) {
  try {
    const allowed = await consumeRateLimit(requestIdentity(request), "create-audit", 5, 600);
    if (!allowed) {
      return NextResponse.json(
        { error: "檢測次數過於頻繁，請在 10 分鐘後再試" },
        { status: 429, headers: { "retry-after": "600" } },
      );
    }
    const body = RequestSchema.parse(await request.json());
    const normalized = normalizeHttpUrl(body.url);
    const url = normalized.toString();
    const { audit, reused } = await createOrReuseAudit(url);
    if (audit.status === "completed") {
      return NextResponse.json(
        { id: audit.id, status: audit.status, path: resultPathForUrl(normalized), reused: true },
        { status: 200 },
      );
    }
    try {
      await enqueueAudit(audit.id, url);
    } catch (error) {
      if (!reused) {
        await failAudit(audit.id, error instanceof Error ? error.message : "掃描工作無法排入佇列");
      }
      return NextResponse.json({ error: "掃描服務暫時忙碌，請稍後再試" }, { status: 503 });
    }
    return NextResponse.json(
      { id: audit.id, status: audit.status, path: resultPathForUrl(normalized) },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "請輸入有效的網站網址"
        : error instanceof Error
          ? error.message
          : "請檢查輸入的網址";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
