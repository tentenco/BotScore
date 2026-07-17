import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuditLive } from "@/components/audit-live";
import { parseResultHostname } from "@/lib/audit/result-url";
import { getLatestAuditByHostname } from "@/lib/server/database";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain: segment } = await params;
  const domain = parseResultHostname(segment);
  return domain
    ? {
        title: `${domain} AI 搜尋準備度檢測`,
        robots: { index: false, follow: false },
      }
    : {};
}

export default async function DomainResultPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain: segment } = await params;
  const domain = parseResultHostname(segment);
  if (!domain) notFound();

  const audit = await getLatestAuditByHostname(domain);
  if (!audit) notFound();

  return <AuditLive auditId={audit.id} />;
}
