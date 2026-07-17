import type { AuditEvidence, AuditScores, Finding, Pillar, PillarScore } from "./types";

const FACTORS = {
  pass: 1,
  warn: 0.55,
  fail: 0,
} as const;

function scorePillar(findings: Finding[], pillar: Pillar): PillarScore {
  const rules = findings.filter(
    (finding) => finding.pillar === pillar && !finding.informational && finding.weight > 0,
  );
  const evaluated = rules.filter((finding) =>
    ["pass", "warn", "fail"].includes(finding.state),
  );
  const applicableWeight = rules.reduce((sum, finding) => sum + finding.weight, 0);
  const evaluatedWeight = evaluated.reduce((sum, finding) => sum + finding.weight, 0);
  const earned = evaluated.reduce(
    (sum, finding) => sum + FACTORS[finding.state as keyof typeof FACTORS] * finding.weight,
    0,
  );

  return {
    score: evaluatedWeight ? Math.round((earned / evaluatedWeight) * 100) : null,
    coverage: applicableWeight ? Math.round((evaluatedWeight / applicableWeight) * 100) : 0,
    evaluated: evaluated.length,
    applicable: rules.length,
  };
}

export function calculateScores(findings: Finding[], evidence: AuditEvidence): AuditScores {
  const seo = scorePillar(findings, "seo");
  const aeo = scorePillar(findings, "aeo");
  const geo = scorePillar(findings, "geo");
  const trust = scorePillar(findings, "trust");

  const weighted = [
    { value: seo, weight: 0.45 },
    { value: aeo, weight: 0.3 },
    { value: geo, weight: 0.25 },
  ];
  const available = weighted.filter((item) => item.value.score !== null);
  const availableWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const overallCoverage = Math.round(
    weighted.reduce((sum, item) => sum + item.value.coverage * item.weight, 0),
  );
  let overall = availableWeight
    ? Math.round(
        available.reduce(
          (sum, item) => sum + (item.value.score ?? 0) * (item.weight / availableWeight),
          0,
        ),
      )
    : null;

  if (overallCoverage < 50) overall = null;
  if (overall !== null && evidence.fetch.status >= 500) overall = Math.min(overall, 20);

  const googleBlocked = evidence.robots.policies.Googlebot === false;
  const directives = [
    evidence.rawPage.metaRobots,
    evidence.renderedPage.metaRobots,
    evidence.fetch.headers["x-robots-tag"] ?? "",
  ]
    .filter(Boolean)
    .join(", ");
  if (overall !== null && (googleBlocked || /(?:^|[,\s])noindex(?:$|[,\s])/i.test(directives))) {
    overall = Math.min(overall, 39);
  }

  const canonicalRule = findings.find((finding) => finding.ruleId === "seo.index.canonical_valid");
  if (seo.score !== null && canonicalRule?.state === "fail") seo.score = Math.min(seo.score, 59);

  return { seo, aeo, geo, trust, overall, overallCoverage };
}
