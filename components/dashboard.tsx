"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Github,
  RefreshCw,
  Key,
  Package,
  BarChart3,
  X,
} from "lucide-react";
import { RepositoryList } from "@/components/repository-list";
import { ScanResults } from "@/components/scan-results";
import { RiskChart } from "@/components/risk-chart";
import { ThemeToggle } from "@/components/theme-toggle";

interface ScanSummary {
  totalRepositories: number;
  repositoriesScanned: number;
  secretsFound: number;
  dependencyRisks: number;
  isScanning: boolean;
  scanProgress: number;
  scanningRepositoryCount: number;
}

export function Dashboard() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<ScanSummary>({
    totalRepositories: 0,
    repositoriesScanned: 0,
    secretsFound: 0,
    dependencyRisks: 0,
    isScanning: false,
    scanProgress: 0,
    scanningRepositoryCount: 0,
  });

  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("repositories");

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const response = await fetch("/api/repositories");
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories);
        setSummary((prev) => ({
          ...prev,
          totalRepositories: data.repositories.length,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    }
  };

  const startScan = async (repoIds?: string[]) => {
    setSummary((prev) => ({ ...prev, isScanning: true, scanProgress: 0 }));

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryIds: repoIds }),
      });

      if (response.ok) {
        pollScanProgress();
      }
    } catch (error) {
      console.error("Failed to start scan:", error);
      setSummary((prev) => ({ ...prev, isScanning: false }));
    }
  };

  const cancelScan = async () => {
    try {
      const response = await fetch("/api/scan/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setSummary((prev) => ({ ...prev, isScanning: false }));
        fetchRepositories();
      }
    } catch (error) {
      console.error("Failed to cancel scan:", error);
    }
  };

  const pollScanProgress = async () => {
    let pollCount = 0;
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/scan/status");
        if (response.ok) {
          const data = await response.json();

          setSummary((prev) => ({
            ...prev,
            scanProgress: data.progress,
            repositoriesScanned: data.scannedCount,
            secretsFound: data.secretsFound,
            dependencyRisks: data.dependencyRisks,
            scanningRepositoryCount:
              data.totalRepositories || prev.scanningRepositoryCount,
            isScanning: data.completed ? false : prev.isScanning,
          }));

          if (
            !data.completed &&
            data.totalRepositories > 1 &&
            pollCount % 4 === 0
          ) {
            fetchRepositories();
          }

          if (data.completed) {
            clearInterval(interval);
            fetchRepositories();
          }

          pollCount++;
        }
      } catch (error) {
        console.error("Failed to fetch scan status:", error);
      }
    }, 2000);
  };

  const securityScore =
    summary.totalRepositories > 0
      ? Math.max(
          0,
          100 -
            ((summary.secretsFound + summary.dependencyRisks) /
              summary.totalRepositories) *
              20
        ).toFixed(0)
      : "100";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="container flex items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Shield className="h-8 w-8 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <h1 className="font-display truncate text-xl font-semibold tracking-tight md:text-2xl">
                RepoScanner
              </h1>
              <p className="truncate text-xs text-muted-foreground md:text-sm">
                Security overview
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full border border-border/80 object-cover"
              />
            ) : null}
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-foreground sm:inline">
              {session?.user?.name}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 md:py-10">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total repositories
              </CardTitle>
              <Github className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {summary.totalRepositories}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.repositoriesScanned} scanned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Secrets found
              </CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold tabular-nums text-destructive">
                {summary.secretsFound}
              </p>
              <p className="text-xs text-muted-foreground">
                Redacted detections
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dependency risks
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold tabular-nums text-warning">
                {summary.dependencyRisks}
              </p>
              <p className="text-xs text-muted-foreground">
                From lockfiles &amp; manifests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Security score
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold tabular-nums text-success">
                {securityScore}%
              </p>
              <p className="text-xs text-muted-foreground">
                Heuristic from findings
              </p>
            </CardContent>
          </Card>
        </div>

        {summary.isScanning && (
          <Card className="mb-8 border-primary/20 shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <RefreshCw
                  className="h-5 w-5 animate-spin max-[prefers-reduced-motion:reduce]:animate-none"
                  aria-hidden
                />
                Scanning repositories
              </CardTitle>
              <CardDescription>
                Progress updates every few seconds. You can cancel if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={summary.scanProgress} aria-label="Scan progress" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {summary.scanProgress}% complete — {summary.repositoriesScanned}{" "}
                  of{" "}
                  {summary.scanningRepositoryCount > 0
                    ? summary.scanningRepositoryCount
                    : summary.totalRepositories}{" "}
                  repositories
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelScan}
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Cancel scan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          <Button
            onClick={() => startScan()}
            disabled={summary.isScanning}
            className="rounded-full"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                summary.isScanning
                  ? "animate-spin max-[prefers-reduced-motion:reduce]:animate-none"
                  : ""
              }`}
              aria-hidden
            />
            {summary.isScanning ? "Scanning…" : "Rescan all repositories"}
          </Button>
          <Button variant="outline" onClick={fetchRepositories} className="rounded-full">
            <Github className="mr-2 h-4 w-4" aria-hidden />
            Refresh repository list
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="findings">Security findings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="repositories" className="space-y-4 focus-visible:outline-none">
            <RepositoryList
              repositories={repositories}
              onSelectRepository={(repoId) => {
                if (repoId && repoId !== "undefined") {
                  setSelectedRepo(repoId);
                  setActiveTab("findings");
                }
              }}
              onScanRepository={(repoId) => startScan([repoId])}
              isScanning={summary.isScanning}
            />
          </TabsContent>

          <TabsContent value="findings" className="space-y-4 focus-visible:outline-none">
            <ScanResults selectedRepository={selectedRepo} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 focus-visible:outline-none">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <RiskChart repositories={repositories} />
              <Card>
                <CardHeader>
                  <CardTitle>Security trends</CardTitle>
                  <CardDescription>
                    Historical trends will appear after multiple scans.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30 py-14 text-center"
                    role="status"
                  >
                    <BarChart3
                      className="h-10 w-10 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="max-w-xs text-sm text-muted-foreground">
                      No trend series yet. Run scans over time to compare
                      results here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
