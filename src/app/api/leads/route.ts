import { NextResponse } from "next/server";
import { z } from "zod";

import { consumeRateLimit, createReportAccess, getAudit, saveLead } from "@/lib/server/database";
import { deliverLead } from "@/lib/server/integrations";
import { requestIdentity } from "@/lib/server/request-identity";

export const runtime = "nodejs";

const LeadSchema = z.object({
  auditId: z.string().uuid(),
  email: z.email(),
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  marketingConsent: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const allowed = await consumeRateLimit(requestIdentity(request), "unlock-report", 10, 3_600);
    if (!allowed) {
      return NextResponse.json(
        { error: "報告請求次數過於頻繁，請稍後再試" },
        { status: 429, headers: { "retry-after": "3600" } },
      );
    }
    const input = LeadSchema.parse(await request.json());
    const audit = await getAudit(input.auditId);
    if (!audit || audit.status !== "completed" || !audit.result) {
      return NextResponse.json({ error: "診斷尚未完成或已不存在" }, { status: 409 });
    }

    const lead = await saveLead(input);
    const access = await createReportAccess(input.auditId, lead.email);
    const delivery = await deliverLead(input, audit.result, access.token);
    return NextResponse.json(delivery);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "請確認 Email 與表單資料是否正確"
        : error instanceof Error
          ? error.message
          : "無法建立完整報告";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
