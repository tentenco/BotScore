import { PgBoss } from "pg-boss";

export const AUDIT_QUEUE = "site-audit";

interface AuditJobData {
  auditId: string;
  url: string;
}

declare global {
  var __botScoreBoss: Promise<PgBoss> | undefined;
}

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required");
  return value;
}

async function initializeBoss() {
  const boss = new PgBoss({
    connectionString: connectionString(),
    application_name: "botscore",
    max: Number(process.env.QUEUE_DATABASE_POOL_MAX ?? 5),
    useListenNotify: true,
  });
  boss.on("error", (error) => console.error("pg-boss error", error));
  await boss.start();
  const queueOptions = {
    retryLimit: Number(process.env.AUDIT_RETRY_LIMIT ?? 2),
    retryDelay: Number(process.env.AUDIT_RETRY_DELAY_SECONDS ?? 15),
    retryBackoff: true,
    retryDelayMax: 120,
    expireInSeconds: Number(process.env.AUDIT_JOB_TIMEOUT_SECONDS ?? 300),
    heartbeatSeconds: 30,
    retentionSeconds: 86_400,
    deleteAfterSeconds: 604_800,
    notify: true,
  };
  await boss.createQueue(AUDIT_QUEUE, queueOptions);
  await boss.updateQueue(AUDIT_QUEUE, queueOptions);
  return boss;
}

export function getBoss() {
  if (!globalThis.__botScoreBoss) {
    const pending = initializeBoss();
    globalThis.__botScoreBoss = pending;
    void pending.catch(() => {
      if (globalThis.__botScoreBoss === pending) globalThis.__botScoreBoss = undefined;
    });
  }
  return globalThis.__botScoreBoss;
}

export async function enqueueAudit(id: string, url: string) {
  const boss = await getBoss();
  const jobId = await boss.send(AUDIT_QUEUE, { auditId: id, url }, {
    id,
    singletonKey: id,
  });
  return jobId ?? id;
}

export type { AuditJobData };
