"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SummaryStatCards } from "@/components/summary-stat-cards";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Github, RefreshCw, X, BarChart3 } from "lucide-react";
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
  /** Single-repo scan: path of the file being processed (from backend live state). */
  scanCurrentFile: string | null;
  scanFileIndex: number;
  scanFileTotal: number;
}

export function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };
  const [summary, setSummary] = useState<ScanSummary>({
    totalRepositories: 0,
    repositoriesScanned: 0,
    secretsFound: 0,
    dependencyRisks: 0,
    isScanning: false,
    scanProgress: 0,
    scanningRepositoryCount: 0,
    scanCurrentFile: null,
    scanFileIndex: 0,
    scanFileTotal: 0,
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
    setSummary((prev) => ({
      ...prev,
      isScanning: true,
      scanProgress: 0,
      scanCurrentFile: null,
      scanFileIndex: 0,
      scanFileTotal: 0,
    }));

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryIds: repoIds }),
      });

      if (response.ok) {
        void pollScanProgress();
      } else {
        setSummary((prev) => ({ ...prev, isScanning: false }));
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
        setSummary((prev) => ({
          ...prev,
          isScanning: false,
          scanCurrentFile: null,
          scanFileIndex: 0,
          scanFileTotal: 0,
        }));
        fetchRepositories();
      }
    } catch (error) {
      console.error("Failed to cancel scan:", error);
    }
  };

  const pollScanProgress = async () => {
    let pollCount = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    let scanFinished = false;

    const tick = async () => {
      try {
        const response = await fetch("/api/scan/status", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();

        setSummary((prev) => ({
          ...prev,
          scanProgress: typeof data.progress === "number" ? data.progress : 0,
          repositoriesScanned: data.scannedCount ?? 0,
          secretsFound: data.secretsFound ?? 0,
          dependencyRisks: data.dependencyRisks ?? 0,
          scanningRepositoryCount:
            data.totalRepositories || prev.scanningRepositoryCount,
          isScanning: data.completed ? false : prev.isScanning,
          scanCurrentFile: data.completed
            ? null
            : typeof data.currentFile === "string" && data.currentFile
              ? data.currentFile
              : null,
          scanFileIndex: data.fileIndex ?? 0,
          scanFileTotal: data.fileTotal ?? 0,
        }));

        if (
          !data.completed &&
          data.totalRepositories > 1 &&
          pollCount > 0 &&
          pollCount % 3 === 0
        ) {
          fetchRepositories();
        }

        pollCount += 1;

        if (data.completed) {
          scanFinished = true;
          if (interval != null) {
            clearInterval(interval);
            interval = null;
          }
          fetchRepositories();
        }
      } catch (error) {
        console.error("Failed to fetch scan status:", error);
      }
    };

    await tick();
    if (!scanFinished) {
      interval = setInterval(() => {
        void tick();
      }, 400);
    }
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
            <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 md:py-10">
        <SummaryStatCards
          totalRepositories={summary.totalRepositories}
          repositoriesScanned={summary.repositoriesScanned}
          secretsFound={summary.secretsFound}
          dependencyRisks={summary.dependencyRisks}
          securityScorePercent={securityScore}
        />

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
                Live progress (single-repo scans step through files). You can cancel if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={summary.scanProgress} aria-label="Scan progress" />
              {summary.scanFileTotal > 0 && summary.scanCurrentFile ? (
                <p className="truncate font-mono text-xs text-muted-foreground" title={summary.scanCurrentFile}>
                  File {summary.scanFileIndex} of {summary.scanFileTotal}: {summary.scanCurrentFile}
                </p>
              ) : null}
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
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start sm:inline-flex sm:h-10 sm:w-auto sm:flex-nowrap">
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
