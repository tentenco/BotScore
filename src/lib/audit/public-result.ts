import type { AuditRecord } from "./types";

export function toPublicAuditRecord(record: AuditRecord): AuditRecord {
  if (!record.result) return record;
  return {
    ...record,
    result: {
      ...record.result,
      findings: record.result.findings.filter((finding) => finding.public),
      narrative: {
        ...record.result.narrative,
        topRisks: record.result.narrative.topRisks.slice(0, 3),
        quickWins: record.result.narrative.quickWins.slice(0, 1),
      },
    },
  };
}
