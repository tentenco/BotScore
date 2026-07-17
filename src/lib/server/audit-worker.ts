import { runAudit } from "@/lib/audit/runner";
import { AUDIT_QUEUE, enqueueAudit, getBoss, type AuditJobData } from "./audit-jobs";
import {
  completeAudit,
  failAudit,
  listQueuedAudits,
  retryAudit,
  startAuditAttempt,
  updateAuditProgress,
} from "./database";

export async function startAuditWorker() {
  const boss = await getBoss();
  const concurrency = Math.max(1, Number(process.env.AUDIT_CONCURRENCY ?? 2));
  const workOptions = {
    includeMetadata: true as const,
    localConcurrency: concurrency,
    pollingIntervalSeconds: 10,
    notifyPollingIntervalSeconds: 30,
    heartbeatRefreshSeconds: 15,
  };
  await boss.work<AuditJobData, void, typeof workOptions>(
    AUDIT_QUEUE,
    workOptions,
    async (jobs) => {
      const job = jobs[0];
      if (!job) return;
      const { auditId, url } = job.data;
      const audit = await startAuditAttempt(auditId);
      if (!audit) return;

      try {
        const result = await runAudit(auditId, url, (progress, stage) =>
          updateAuditProgress(auditId, progress, stage),
        );
        await completeAudit(auditId, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "無法完成網站診斷";
        const hasRetry = job.retryCount < job.retryLimit;
        if (hasRetry) await retryAudit(auditId, message);
        else await failAudit(auditId, message);
        throw error;
      }
    },
  );
  return boss;
}

export async function recoverQueuedAudits() {
  const queued = await listQueuedAudits();
  await Promise.all(queued.map((audit) => enqueueAudit(audit.id, audit.url)));
  return queued.length;
}
