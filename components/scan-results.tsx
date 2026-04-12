"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Key,
  Package,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Shield,
  Copy,
  CheckCircle,
} from "lucide-react";

interface SecretFinding {
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

interface DependencyRisk {
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

interface ScanResultsProps {
  selectedRepository: string | null;
}

export function ScanResults({ selectedRepository }: ScanResultsProps) {
  const [secrets, setSecrets] = useState<SecretFinding[]>([]);
  const [dependencies, setDependencies] = useState<DependencyRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRedacted, setShowRedacted] = useState(true);

  useEffect(() => {
    if (selectedRepository && selectedRepository !== "undefined") {
      fetchScanResults();
    }
  }, [selectedRepository]);

  const fetchScanResults = async () => {
    if (!selectedRepository || selectedRepository === "undefined") {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/scan/results/${selectedRepository}`
      );
      if (response.ok) {
        const data = await response.json();
        setSecrets(data.secrets || []);
        setDependencies(data.dependencies || []);
      }
    } catch (error) {
      console.error("Failed to fetch scan results:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "destructive" as const;
      case "medium":
        return "warning" as const;
      default:
        return "secondary" as const;
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  if (!selectedRepository) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <Shield
            className="h-12 w-12 text-muted-foreground"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              No repository selected
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choose a repository from the Repositories tab to load secrets and
              dependency findings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4" role="status" aria-live="polite">
          <span className="sr-only">Loading scan results</span>
          <Skeleton className="h-10 w-full rounded-pill" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Loading scan results…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Security findings
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setShowRedacted(!showRedacted)}
        >
          {showRedacted ? (
            <EyeOff className="mr-2 h-4 w-4" aria-hidden />
          ) : (
            <Eye className="mr-2 h-4 w-4" aria-hidden />
          )}
          {showRedacted ? "Hide" : "Show"} redacted values
        </Button>
      </div>

      <Tabs defaultValue="secrets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="secrets" className="gap-2">
            <Key className="h-4 w-4" aria-hidden />
            <span>Secrets ({secrets.length})</span>
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="gap-2">
            <Package className="h-4 w-4" aria-hidden />
            <span>Dependencies ({dependencies.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="secrets" className="space-y-4">
          {secrets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle
                  className="h-12 w-12 text-success"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  No exposed secrets detected in this repository for the last
                  scan.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {secrets.map((secret) => (
                <Card
                  key={secret.id}
                  className="border-l-[3px] border-l-destructive"
                >
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                          <Key
                            className="h-5 w-5 shrink-0 text-destructive"
                            aria-hidden
                          />
                          <span className="break-words">
                            {secret.provider} {secret.type}
                          </span>
                          <Badge variant={getSeverityVariant(secret.severity)}>
                            {secret.severity}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="font-mono text-xs">
                            {secret.file}:{secret.line}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-relaxed">
                      {secret.description}
                    </p>

                    {showRedacted && (
                      <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <code className="break-all text-sm font-mono text-foreground">
                            {secret.redactedValue}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-full"
                            onClick={() =>
                              copyToClipboard(secret.redactedValue)
                            }
                            aria-label="Copy redacted fragment"
                          >
                            <Copy className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg border border-border/80 bg-accent/40 p-3">
                      <h4 className="mb-2 flex items-center text-sm font-semibold text-foreground">
                        <Shield
                          className="mr-2 h-4 w-4 text-primary"
                          aria-hidden
                        />
                        Remediation
                      </h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {secret.remediation}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          {dependencies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <CheckCircle
                  className="h-12 w-12 text-success"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  No flagged dependency issues for this scan.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {dependencies.map((dep) => (
                <Card
                  key={dep.id}
                  className="border-l-[3px] border-l-warning"
                >
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                          <Package
                            className="h-5 w-5 shrink-0 text-warning"
                            aria-hidden
                          />
                          <span>{dep.package}</span>
                          <Badge variant="outline">{dep.version}</Badge>
                          <Badge variant={getSeverityVariant(dep.riskLevel)}>
                            {dep.riskLevel}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {dep.vulnerability}
                          {dep.cve && (
                            <span className="ml-2 font-mono text-xs">
                              ({dep.cve})
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      {dep.advisoryUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-full"
                          onClick={() =>
                            window.open(dep.advisoryUrl, "_blank")
                          }
                        >
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                          Advisory
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-relaxed">
                      {dep.description}
                    </p>

                    <div className="rounded-lg border border-border/80 bg-muted/50 p-3">
                      <h4 className="mb-2 flex items-center text-sm font-semibold text-foreground">
                        <Shield
                          className="mr-2 h-4 w-4 text-success"
                          aria-hidden
                        />
                        Recommended action
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Update to version{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                          {dep.recommendedVersion}
                        </code>{" "}
                        or later.
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() =>
                            copyToClipboard(
                              `npm update ${dep.package}@${dep.recommendedVersion}`
                            )
                          }
                        >
                          <Copy className="mr-2 h-4 w-4" aria-hidden />
                          Copy update command
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
