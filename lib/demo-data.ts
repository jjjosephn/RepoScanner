/**
 * Static marketing demo payloads only. Not tied to GitHub or the scan API.
 * Edit here to change sample repositories, findings, and copy.
 */

export const DEMO_SUMMARY = {
  totalRepositories: 3,
  repositoriesScanned: 3,
  secretsFound: 4,
  dependencyRisks: 2,
} as const;

/** Heuristic-style score string for display (illustrative). */
export const DEMO_SECURITY_SCORE = "72";

export type DemoRepoScanStatus = "clean" | "issues" | "never" | "scanning";

export interface DemoRepository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  scanStatus: DemoRepoScanStatus;
  secretsCount: number;
  dependencyRisks: number;
  language: string;
}

export const DEMO_REPOSITORIES: DemoRepository[] = [
  {
    id: "demo-repo-payment",
    name: "payment-service",
    fullName: "acme-corp/payment-service",
    description:
      "Sample API service — illustrative repo name only, not a real scan.",
    scanStatus: "issues",
    secretsCount: 2,
    dependencyRisks: 1,
    language: "TypeScript",
  },
  {
    id: "demo-repo-auth",
    name: "auth-gateway",
    fullName: "acme-corp/auth-gateway",
    description: "Sample edge auth layer (fictional).",
    scanStatus: "issues",
    secretsCount: 2,
    dependencyRisks: 1,
    language: "Go",
  },
  {
    id: "demo-repo-docs",
    name: "internal-docs",
    fullName: "acme-corp/internal-docs",
    description: "Sample static site (fictional).",
    scanStatus: "clean",
    secretsCount: 0,
    dependencyRisks: 0,
    language: "MDX",
  },
];

export interface DemoSecretFinding {
  id: string;
  type: string;
  provider: string;
  file: string;
  line: number;
  severity: "high" | "medium" | "low";
  redactedValue: string;
  description: string;
  remediation: string;
}

export const DEMO_SECRET_FINDINGS: DemoSecretFinding[] = [
  {
    id: "demo-sec-1",
    type: "API key",
    provider: "Stripe",
    file: "config/staging.env",
    line: 14,
    severity: "high",
    redactedValue: "sk_live_••••••••9f2a",
    description:
      "High-entropy string matching live Stripe secret key pattern (sample fragment only).",
    remediation:
      "Rotate the key in the Stripe dashboard, revoke the exposed credential, and load secrets from a vault or CI secrets — never commit `.env` files.",
  },
  {
    id: "demo-sec-2",
    type: "Long-lived token",
    provider: "GitHub",
    file: ".github/workflows/deploy.yml",
    line: 31,
    severity: "medium",
    redactedValue: "ghp_••••••••Qx7",
    description:
      "Classic personal access token shape embedded in workflow YAML (illustrative).",
    remediation:
      "Use OIDC or a short-lived `GITHUB_TOKEN` with least privilege; store PATs in repository secrets, not in file contents.",
  },
];

export interface DemoDependencyRisk {
  id: string;
  package: string;
  version: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  vulnerability: string;
  cve?: string;
  advisoryUrl?: string;
  recommendedVersion: string;
  description: string;
}

export const DEMO_DEPENDENCY_RISKS: DemoDependencyRisk[] = [
  {
    id: "demo-dep-1",
    package: "axios",
    version: "1.5.1",
    riskLevel: "high",
    vulnerability:
      "Cross-Site Request Forgery (CSRF) / XSRF bypass when sending requests with `withCredentials` — fixed in later 1.x releases.",
    cve: "CVE-2023-45857",
    advisoryUrl: "https://github.com/advisories/GHSA-wf5p-g6vw-rhxx",
    recommendedVersion: "1.6.4",
    description:
      "Widely used HTTP client; pin to patched 1.6.4+ (or current 1.x) and re-run your lockfile audit. Demo row mirrors a real advisory shape.",
  },
  {
    id: "demo-dep-2",
    package: "synckit",
    version: "0.8.5",
    riskLevel: "critical",
    vulnerability:
      "Supply-chain incident: malicious npm releases in the 0.8.4–0.8.5 range reported as trojanized builds (credential / CI exfiltration risk).",
    advisoryUrl: "https://www.npmjs.com/package/synckit",
    recommendedVersion: "0.8.6",
    description:
      "Treat like a compromised line: bump to a clean patch release, rotate CI/npm tokens if this version was ever installed, and verify lockfiles. Same class of risk as other recent npm supply-chain waves.",
  },
];
