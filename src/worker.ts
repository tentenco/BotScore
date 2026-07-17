import { hostname } from "node:os";

import { recoverQueuedAudits, startAuditWorker } from "@/lib/server/audit-worker";
import { cleanupExpiredData, heartbeat } from "@/lib/server/database";

const instanceId = `${hostname()}:${process.pid}`;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

async function reportHeartbeat() {
  await heartbeat("audit-worker", instanceId, {
    concurrency: Number(process.env.AUDIT_CONCURRENCY ?? 2),
    version: process.env.APP_VERSION ?? "development",
  });
}

async function start() {
  const boss = await startAuditWorker();
  const recovered = await recoverQueuedAudits();
  await reportHeartbeat();
  await cleanupExpiredData();

  heartbeatTimer = setInterval(() => void reportHeartbeat().catch(console.error), 30_000);
  cleanupTimer = setInterval(() => void cleanupExpiredData().catch(console.error), 6 * 60 * 60 * 1_000);
  console.log(`Audit worker ready (${instanceId}); recovered ${recovered} queued job(s)`);

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`Received ${signal}; stopping audit worker`);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (cleanupTimer) clearInterval(cleanupTimer);
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

start().catch((error) => {
  console.error("Audit worker failed to start", error);
  process.exit(1);
});
