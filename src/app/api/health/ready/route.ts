import { NextResponse } from "next/server";

import { checkDatabase, getWorkerHealth } from "@/lib/server/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    await checkDatabase();
    const worker = await getWorkerHealth();
    return NextResponse.json(
      { status: worker.healthy ? "ready" : "degraded", database: "ok", worker },
      { status: worker.healthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: "error", worker: { healthy: false, lastSeen: null } },
      { status: 503 },
    );
  }
}
