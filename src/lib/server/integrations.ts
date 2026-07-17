import "server-only";

import type { AuditResult, LeadCaptureResult } from "@/lib/audit/types";
import type { LeadInput } from "./database";

async function syncHubSpot(input: LeadInput, result: AuditResult) {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return "disabled" as const;

  try {
    const nameParts = input.name?.trim().split(/\s+/) ?? [];
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        inputs: [
          {
            id: input.email.toLowerCase(),
            idProperty: "email",
            properties: {
              email: input.email.toLowerCase(),
              firstname: nameParts[0] ?? "",
              lastname: nameParts.slice(1).join(" "),
              company: input.company ?? "",
              jobtitle: input.role ?? "",
              website: result.finalUrl,
              lifecyclestage: "lead",
              hs_lead_status: "NEW",
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok ? ("synced" as const) : ("failed" as const);
  } catch {
    return "failed" as const;
  }
}

async function sendReport(
  input: LeadInput,
  result: AuditResult,
  reportUrl: string,
): Promise<LeadCaptureResult["deliveryStatus"]> {
  const baseUrl = process.env.LISTMONK_URL;
  const username = process.env.LISTMONK_USERNAME;
  const password = process.env.LISTMONK_PASSWORD;
  const templateId = Number(process.env.LISTMONK_REPORT_TEMPLATE_ID);
  if (!baseUrl || !username || !password || !templateId) return "disabled";

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tx`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        subscriber_email: input.email.toLowerCase(),
        template_id: templateId,
        data: {
          name: input.name || "您好",
          report_url: reportUrl,
          website_url: result.finalUrl,
          overall_score: result.scores.overall,
          seo_score: result.scores.seo.score,
          aeo_score: result.scores.aeo.score,
          geo_score: result.scores.geo.score,
        },
        content_type: "html",
      }),
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function deliverLead(
  input: LeadInput,
  result: AuditResult,
  reportToken: string,
): Promise<LeadCaptureResult> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const reportUrl = `${appUrl}/report/${reportToken}`;
  const [hubspotStatus, deliveryStatus] = await Promise.all([
    syncHubSpot(input, result),
    sendReport(input, result, reportUrl),
  ]);
  return { reportToken, reportUrl, hubspotStatus, deliveryStatus };
}
