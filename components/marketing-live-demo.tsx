"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryStatCards } from "@/components/summary-stat-cards";
import {
  DEMO_REPOSITORIES,
  DEMO_SECRET_FINDINGS,
  DEMO_DEPENDENCY_RISKS,
  DEMO_SUMMARY,
  DEMO_SECURITY_SCORE,
} from "@/lib/demo-data";
import { severityToBadgeVariant } from "@/lib/severity-badge";
import {
  RefreshCw,
  Github,
  Key,
  Package,
  FileText,
  Shield,
  Copy,
  CheckCircle,
  ExternalLink,
  Info,
  Eye,
  EyeOff,
  Play,
} from "lucide-react";

const EMPTY_SUMMARY = {
  totalRepositories: 0,
  repositoriesScanned: 0,
  secretsFound: 0,
  dependencyRisks: 0,
};

/** Scripted demo pacing (slower = larger numbers). */
const DEMO_MS = {
  /** Pause before the sample “scan” bar appears. */
  beforeScan: 900,
  /** Progress bar: number of ticks × tick length ≈ total fill time. */
  progressSteps: 36,
  progressTick: 100,
  /** After 100%: pause before summary stats. */
  afterProgressToSummary: 500,
  /** Each repo row appears this many ms after the previous beat. */
  repoStagger: 550,
  /** Extra delay after last repo before findings panel. */
  afterReposToFindings: 700,
  /** Time between each secret/dependency card “entering” the list. */
  findingCardStagger: 480,
  /** Pause after all secrets before dependency cards start (same timeline). */
  afterSecretsToDeps: 400,
} as const;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** New finding rows: slide in from the left + fade (skipped when reduced motion). */
const findingCardEnter =
  "overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-8 motion-safe:duration-[520ms] motion-safe:ease-out max-[prefers-reduced-motion:reduce]:animate-none";

/** Sample repo rows: enter from above and move down + fade (skipped when reduced motion). */
const repoRowEnter =
  "overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-6 motion-safe:duration-[480ms] motion-safe:ease-out max-[prefers-reduced-motion:reduce]:animate-none";

function DemoRepoRow({ repo }: { repo: (typeof DEMO_REPOSITORIES)[0] }) {
  const statusBadge =
    repo.scanStatus === "clean" ? (
      <Badge variant="success">Clean</Badge>
    ) : repo.scanStatus === "issues" ? (
      <Badge variant="destructive">
        {repo.secretsCount + repo.dependencyRisks} issues
      </Badge>
    ) : (
      <Badge variant="secondary">Not scanned</Badge>
    );

  return (
    <div className={repoRowEnter}>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Github
                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0">
                <CardTitle className="text-lg">{repo.name}</CardTitle>
                <CardDescription className="mt-1 font-mono text-xs">
                  {repo.fullName}
                </CardDescription>
              </div>
            </div>
            {statusBadge}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{repo.description}</p>
          {repo.scanStatus === "issues" && (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              {repo.secretsCount > 0 && (
                <span className="text-destructive">
                  {repo.secretsCount} secret{repo.secretsCount !== 1 ? "s" : ""}
                </span>
              )}
              {repo.dependencyRisks > 0 && (
                <span className="text-warning">
                  {repo.dependencyRisks} dependency risk
                  {repo.dependencyRisks !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MarketingLiveDemo() {
  /** 0 = idle preview; increment to start or replay the scripted demo (motion users only). */
  const [runSeq, setRunSeq] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [visibleRepoCount, setVisibleRepoCount] = useState(0);
  const [findingsVisible, setFindingsVisible] = useState(false);
  const [revealedSecretsCount, setRevealedSecretsCount] = useState(0);
  const [revealedDepsCount, setRevealedDepsCount] = useState(0);
  const [showRedacted, setShowRedacted] = useState(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const findingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const demoEndRef = useRef<HTMLDivElement>(null);
  const scrollFollowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const applyFinalState = useCallback(() => {
    clearTimers();
    setScanProgress(100);
    setIsScanning(false);
    setSummary({ ...DEMO_SUMMARY });
    setVisibleRepoCount(DEMO_REPOSITORIES.length);
    setFindingsVisible(true);
    setRevealedSecretsCount(DEMO_SECRET_FINDINGS.length);
    setRevealedDepsCount(DEMO_DEPENDENCY_RISKS.length);
  }, [clearTimers]);

  /** Reduced motion: show full sample once (no autoplay animation, but immediate content). */
  useEffect(() => {
    if (!prefersReducedMotion()) return;
    applyFinalState();
    setRunSeq(1);
  }, [applyFinalState]);

  /** Scripted demo runs only after the user chooses Run demo / Replay (motion users). */
  useEffect(() => {
    clearTimers();

    if (prefersReducedMotion()) {
      return () => clearTimers();
    }

    if (runSeq === 0) {
      return () => clearTimers();
    }

    setScanProgress(0);
    setIsScanning(false);
    setSummary({ ...EMPTY_SUMMARY });
    setVisibleRepoCount(0);
    setFindingsVisible(false);
    setRevealedSecretsCount(0);
    setRevealedDepsCount(0);

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        fn();
      }, ms);
      timersRef.current.push(id);
    };

    schedule(() => {
      setIsScanning(true);
      let step = 0;
      const steps = DEMO_MS.progressSteps;
      const intervalMs = DEMO_MS.progressTick;
      intervalRef.current = setInterval(() => {
        step += 1;
        const next = Math.min(100, Math.round((step / steps) * 100));
        setScanProgress(next);
        if (step >= steps) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          const t0 = DEMO_MS.afterProgressToSummary;
          const g = DEMO_MS.repoStagger;
          schedule(() => {
            setIsScanning(false);
            setSummary({ ...DEMO_SUMMARY });
          }, t0);
          schedule(() => setVisibleRepoCount(1), t0 + g);
          schedule(() => setVisibleRepoCount(2), t0 + g * 2);
          schedule(() => setVisibleRepoCount(3), t0 + g * 3);
          schedule(
            () => setFindingsVisible(true),
            t0 + g * 3 + DEMO_MS.afterReposToFindings
          );
        }
      }, intervalMs);
    }, DEMO_MS.beforeScan);

    return () => clearTimers();
  }, [runSeq, clearTimers]);

  const startOrReplayDemo = useCallback(() => {
    if (prefersReducedMotion()) {
      applyFinalState();
      return;
    }
    setRunSeq((s) => s + 1);
  }, [applyFinalState]);

  /** Stagger secret then dependency cards (slide-in) after findings shell is visible. */
  useEffect(() => {
    findingTimersRef.current.forEach(clearTimeout);
    findingTimersRef.current = [];

    if (!findingsVisible) {
      setRevealedSecretsCount(0);
      setRevealedDepsCount(0);
      return;
    }

    if (prefersReducedMotion()) {
      setRevealedSecretsCount(DEMO_SECRET_FINDINGS.length);
      setRevealedDepsCount(DEMO_DEPENDENCY_RISKS.length);
      return;
    }

    const g = DEMO_MS.findingCardStagger;
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      findingTimersRef.current.push(id);
    };

    for (let i = 1; i <= DEMO_SECRET_FINDINGS.length; i++) {
      schedule(() => setRevealedSecretsCount(i), i * g);
    }

    const depStart =
      (DEMO_SECRET_FINDINGS.length + 1) * g + DEMO_MS.afterSecretsToDeps;
    for (let j = 1; j <= DEMO_DEPENDENCY_RISKS.length; j++) {
      schedule(() => setRevealedDepsCount(j), depStart + j * g);
    }

    return () => {
      findingTimersRef.current.forEach(clearTimeout);
      findingTimersRef.current = [];
    };
  }, [findingsVisible]);

  /** Keep the bottom of the demo in view as repos / findings grow (only if section is on-screen). */
  useEffect(() => {
    const idle = runSeq === 0 && !isScanning;
    if (idle) return;

    const section = sectionRef.current;
    if (!section) return;

    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;
    const margin = 48;
    const overlapsViewport =
      rect.bottom > margin && rect.top < vh - margin;
    if (!overlapsViewport) return;

    if (scrollFollowTimeoutRef.current) {
      clearTimeout(scrollFollowTimeoutRef.current);
    }

    const reduced = prefersReducedMotion();
    const delayMs = reduced ? 0 : 100;

    scrollFollowTimeoutRef.current = setTimeout(() => {
      scrollFollowTimeoutRef.current = null;
      demoEndRef.current?.scrollIntoView({
        block: "end",
        inline: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
    }, delayMs);

    return () => {
      if (scrollFollowTimeoutRef.current) {
        clearTimeout(scrollFollowTimeoutRef.current);
        scrollFollowTimeoutRef.current = null;
      }
    };
  }, [
    visibleRepoCount,
    findingsVisible,
    revealedSecretsCount,
    revealedDepsCount,
    summary.totalRepositories,
    isScanning,
    runSeq,
  ]);

  const copyDemo = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const score =
    summary.totalRepositories > 0 ? DEMO_SECURITY_SCORE : "0";

  return (
    <section
      ref={sectionRef}
      id="live-demo"
      className="mx-auto mt-24 max-w-5xl scroll-mt-24 border border-border/80 bg-card/60 p-6 shadow-card backdrop-blur-sm md:mt-28 md:rounded-xl md:p-8"
      aria-labelledby="live-demo-heading"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="live-demo-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          >
            Live demo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Same layout as the signed-in dashboard—run the scripted sample when
            you are ready (no GitHub or backend).
          </p>
        </div>
        {(prefersReducedMotion() || runSeq > 0) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => startOrReplayDemo()}
            disabled={!prefersReducedMotion() && isScanning}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            {prefersReducedMotion() ? "Show sample again" : "Replay demo"}
          </Button>
        )}
      </div>

      <div
        className="mb-6 flex gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm text-foreground"
        role="note"
      >
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
        <p>
          <span className="font-semibold">Sample data — not your repositories.</span>{" "}
          Names, paths, CVE-style labels, and fragments are fictional and for
          layout only. No code of yours is read or scanned on this page.
        </p>
      </div>

      {runSeq === 0 && !prefersReducedMotion() && (
        <div className="mb-8 space-y-8">
          <SummaryStatCards
            totalRepositories={EMPTY_SUMMARY.totalRepositories}
            repositoriesScanned={EMPTY_SUMMARY.repositoriesScanned}
            secretsFound={EMPTY_SUMMARY.secretsFound}
            dependencyRisks={EMPTY_SUMMARY.dependencyRisks}
            securityScorePercent="0"
          />
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Sample repositories
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              One example row below — run the demo to animate a full scan and
              findings.
            </p>
            <div className="mt-4">
              <DemoRepoRow repo={DEMO_REPOSITORIES[0]} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 border border-dashed border-border/80 bg-muted/20 py-10">
            <p className="text-center text-sm text-muted-foreground">
              See the progress bar, stats, and sample findings play out.
            </p>
            <Button
              type="button"
              size="lg"
              className="rounded-full px-8"
              onClick={() => startOrReplayDemo()}
            >
              <Play className="mr-2 h-4 w-4" aria-hidden />
              Run demo
            </Button>
          </div>
        </div>
      )}

      {isScanning && (
        <Card className="mb-8 border-primary/20 shadow-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw
                className="h-5 w-5 motion-safe:animate-spin max-[prefers-reduced-motion:reduce]:animate-none"
                aria-hidden
              />
              Sample scan in progress
            </CardTitle>
            <CardDescription>
              Illustration only — progress is scripted, not a live engine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={scanProgress} aria-label="Sample scan progress" />
            <p className="text-sm text-muted-foreground">
              {scanProgress}% complete — scanning {DEMO_REPOSITORIES.length}{" "}
              sample repositories
            </p>
          </CardContent>
        </Card>
      )}

      {summary.totalRepositories > 0 && (
        <SummaryStatCards
          totalRepositories={summary.totalRepositories}
          repositoriesScanned={summary.repositoriesScanned}
          secretsFound={summary.secretsFound}
          dependencyRisks={summary.dependencyRisks}
          securityScorePercent={score}
        />
      )}

      {visibleRepoCount > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Sample repositories
          </h3>
          {DEMO_REPOSITORIES.slice(0, visibleRepoCount).map((repo) => (
            <DemoRepoRow key={repo.id} repo={repo} />
          ))}
        </div>
      )}

      {findingsVisible && (
        <div className="mt-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 max-[prefers-reduced-motion:reduce]:animate-none">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Sample security findings
              </h3>
              <Button
                type="button"
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
                  <span>Secrets ({DEMO_SECRET_FINDINGS.length})</span>
                </TabsTrigger>
                <TabsTrigger value="dependencies" className="gap-2">
                  <Package className="h-4 w-4" aria-hidden />
                  <span>Dependencies ({DEMO_DEPENDENCY_RISKS.length})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="secrets"
                forceMount
                className="space-y-4 data-[state=inactive]:hidden"
              >
                {DEMO_SECRET_FINDINGS.slice(0, revealedSecretsCount).map((secret) => (
                  <Card
                    key={secret.id}
                    className={`border-l-[3px] border-l-destructive ${findingCardEnter}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                        <Key
                          className="h-5 w-5 shrink-0 text-destructive"
                          aria-hidden
                        />
                        <span>
                          {secret.provider} {secret.type}
                        </span>
                        <Badge variant={severityToBadgeVariant(secret.severity)}>
                          {secret.severity}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="font-mono text-xs">
                          {secret.file}:{secret.line}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm leading-relaxed">{secret.description}</p>
                      {showRedacted && (
                        <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <code className="break-all text-sm font-mono text-foreground">
                              {secret.redactedValue}
                            </code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 rounded-full"
                              onClick={() => copyDemo(secret.redactedValue)}
                              aria-label="Copy redacted fragment (sample)"
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
              </TabsContent>

              <TabsContent
                value="dependencies"
                forceMount
                className="space-y-4 data-[state=inactive]:hidden"
              >
                {DEMO_DEPENDENCY_RISKS.slice(0, revealedDepsCount).map((dep) => (
                  <Card
                    key={dep.id}
                    className={`border-l-[3px] border-l-warning ${findingCardEnter}`}
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
                            <Badge variant={severityToBadgeVariant(dep.riskLevel)}>
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
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 rounded-full"
                            onClick={() =>
                              window.open(dep.advisoryUrl, "_blank")
                            }
                          >
                            <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                            Advisory (demo link)
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm leading-relaxed">{dep.description}</p>
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
                          or later (sample text).
                        </p>
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() =>
                              copyDemo(
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
              </TabsContent>
            </Tabs>

            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle
                  className="h-10 w-10 text-success"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  After you sign in, your real repositories and scan results
                  replace this sample panel.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Scroll target: keep bottom of demo in view as content grows */}
      <div
        ref={demoEndRef}
        className="h-px w-full shrink-0 scroll-mt-8"
        aria-hidden
      />
    </section>
  );
}
