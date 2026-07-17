export type RuleState = "pass" | "warn" | "fail" | "unknown" | "not_applicable";
export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Pillar = "seo" | "aeo" | "geo" | "trust";
export type Confidence = "high" | "medium" | "low";

export type AuditStatus = "queued" | "running" | "completed" | "failed";

export interface RedirectHop {
  url: string;
  status: number;
  location: string;
}

export interface FetchEvidence {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  redirects: RedirectHop[];
  durationMs: number;
}

export interface HeadingEvidence {
  level: number;
  text: string;
}

export interface PageEvidence {
  title: string;
  description: string;
  canonical: string | null;
  metaRobots: string;
  htmlLang: string;
  viewport: string;
  h1: string[];
  headings: HeadingEvidence[];
  text: string;
  wordCount: number;
  firstParagraph: string;
  internalLinks: string[];
  externalLinks: string[];
  images: {
    total: number;
    missingAlt: number;
    missingDimensions: number;
  };
  jsonLd: {
    blockCount: number;
    parseErrors: number;
    types: string[];
    organizationNames: string[];
  };
  hreflang: Array<{ lang: string; href: string }>;
  landmarks: string[];
  interactiveControls: {
    total: number;
    unnamed: number;
  };
  signals: {
    hasAuthor: boolean;
    hasPublishedDate: boolean;
    hasModifiedDate: boolean;
    hasDefinition: boolean;
    hasQuestionHeading: boolean;
    hasList: boolean;
    hasTable: boolean;
    hasContactLink: boolean;
    hasPrivacyLink: boolean;
    hasTermsLink: boolean;
  };
}

export interface RobotsEvidence {
  found: boolean;
  body: string;
  sitemapUrls: string[];
  policies: Record<string, boolean | null>;
}

export interface SitemapEvidence {
  found: boolean;
  valid: boolean;
  url: string | null;
  urlCount: number;
  sampleUrls: string[];
  error: string | null;
}

export interface RenderEvidence {
  attempted: boolean;
  succeeded: boolean;
  html: string;
  error: string | null;
}

export interface AuditEvidence {
  fetch: FetchEvidence;
  rawPage: PageEvidence;
  renderedPage: PageEvidence;
  render: RenderEvidence;
  robots: RobotsEvidence;
  sitemap: SitemapEvidence;
  llmsTxt: { found: boolean; valid: boolean };
}

export interface Finding {
  ruleId: string;
  pillar: Pillar;
  category: string;
  state: RuleState;
  severity: Severity;
  confidence: Confidence;
  weight: number;
  title: string;
  observed: string;
  impact: string;
  recommendation: string;
  verification: string;
  sourceUrl: string;
  sourceCheckedAt: string;
  public: boolean;
  informational?: boolean;
}

export interface PillarScore {
  score: number | null;
  coverage: number;
  evaluated: number;
  applicable: number;
}

export interface AuditScores {
  seo: PillarScore;
  aeo: PillarScore;
  geo: PillarScore;
  trust: PillarScore;
  overall: number | null;
  overallCoverage: number;
}

export interface AuditNarrative {
  executiveSummary: string;
  topRisks: string[];
  quickWins: string[];
  limitations: string[];
  generatedBy: "deterministic" | "openrouter";
  model?: string;
}

export interface AuditResult {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  scannedAt: string;
  durationMs: number;
  title: string;
  scores: AuditScores;
  findings: Finding[];
  narrative: AuditNarrative;
  stats: {
    passed: number;
    warnings: number;
    failed: number;
    unknown: number;
  };
  technical: {
    status: number;
    rendered: boolean;
    redirects: number;
    sitemapUrls: number;
    schemaTypes: string[];
    wordCount: number;
  };
  ruleVersion: string;
}

export interface AuditRecord {
  id: string;
  url: string;
  status: AuditStatus;
  stage: string;
  progress: number;
  result: AuditResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadCaptureResult {
  reportToken: string;
  reportUrl: string;
  hubspotStatus: "synced" | "disabled" | "failed";
  deliveryStatus: "sent" | "disabled" | "failed";
}
