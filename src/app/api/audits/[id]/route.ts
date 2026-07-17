import { NextResponse } from "next/server";

import { toPublicAuditRecord } from "@/lib/audit/public-result";
import { getAudit } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const audit = await getAudit(id);
  if (!audit) return NextResponse.json({ error: "找不到這次檢測" }, { status: 404 });
  return NextResponse.json(toPublicAuditRecord(audit));
}
