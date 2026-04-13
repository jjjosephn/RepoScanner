"use client";

import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, Github, Scan, AlertTriangle } from "lucide-react";
import { Dashboard } from "@/components/dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageLoading } from "@/components/page-loading";
import { MarketingLiveDemo } from "@/components/marketing-live-demo";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <PageLoading />;
  }

  if (!session) {
    return (
      <div className="marketing-surface">
        <div className="marketing-content">
          <header className="border-b border-border/60 bg-card/40 backdrop-blur-md">
            <div className="container flex items-center justify-between py-4">
              <div className="flex items-center gap-2">
                <Shield
                  className="h-8 w-8 text-primary"
                  aria-hidden
                />
                <span className="font-display text-lg font-semibold tracking-tight text-foreground">
                  RepoScanner
                </span>
              </div>
              <ThemeToggle />
            </div>
          </header>

          <main className="container py-16 md:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                GitHub security
              </p>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Scan repos for secrets &amp; risky dependencies
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
                Detect exposed credentials with pattern and entropy checks, and
                review dependency risk from your dashboards—without storing raw
                secrets.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={() => signIn("github")}
                  size="lg"
                  className="rounded-full px-8"
                >
                  <Github className="mr-2 h-5 w-5" aria-hidden />
                  Sign in with GitHub
                </Button>
                <a
                  href="#live-demo"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  View sample demo
                </a>
              </div>
            </div>

            <div className="mx-auto mt-20 grid max-w-5xl gap-6 md:grid-cols-3">
              <Card className="border-border/80 bg-card/85 shadow-card backdrop-blur-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Scan className="h-5 w-5 text-primary" aria-hidden />
                    Secrets detection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Pattern matching plus entropy scoring for API keys, tokens,
                    and common credential shapes—shown redacted.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/85 shadow-card backdrop-blur-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle
                      className="h-5 w-5 text-warning"
                      aria-hidden
                    />
                    Dependency analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Flag vulnerable or suspicious packages using manifest and
                    lockfile context, with remediation hints.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/85 shadow-card backdrop-blur-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="h-5 w-5 text-success" aria-hidden />
                    Privacy first
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    Sensitive matches stay redacted; analysis runs in your
                    environment with minimal retained data.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            <MarketingLiveDemo />
          </main>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
