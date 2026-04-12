"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Github,
  Scan,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  private: boolean;
  lastScanned: string | null;
  scanStatus: "clean" | "issues" | "scanning" | "never";
  secretsCount: number;
  dependencyRisks: number;
  language: string;
  updatedAt: string;
}

interface RepositoryListProps {
  repositories: Repository[];
  onSelectRepository: (repoId: string) => void;
  onScanRepository: (repoId: string) => void;
  isScanning: boolean;
}

export function RepositoryList({
  repositories,
  onSelectRepository,
  onScanRepository,
  isScanning,
}: RepositoryListProps) {
  const [filter, setFilter] = useState<"all" | "clean" | "issues" | "never">(
    "all"
  );

  const filteredRepositories = repositories.filter((repo) => {
    if (filter === "all") return true;
    return repo.scanStatus === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "clean":
        return (
          <CheckCircle
            className="h-4 w-4 text-success"
            aria-hidden
          />
        );
      case "issues":
        return (
          <XCircle
            className="h-4 w-4 text-destructive"
            aria-hidden
          />
        );
      case "scanning":
        return (
          <Scan
            className="h-4 w-4 text-primary motion-safe:animate-pulse max-[prefers-reduced-motion:reduce]:animate-none"
            aria-hidden
          />
        );
      default:
        return (
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
        );
    }
  };

  const getStatusBadge = (repo: Repository) => {
    if (repo.scanStatus === "clean") {
      return <Badge variant="success">Clean</Badge>;
    }
    if (repo.scanStatus === "issues") {
      return (
        <Badge variant="destructive">
          {repo.secretsCount + repo.dependencyRisks} issues
        </Badge>
      );
    }
    if (repo.scanStatus === "scanning") {
      return <Badge variant="secondary">Scanning…</Badge>;
    }
    return <Badge variant="secondary">Not scanned</Badge>;
  };

  const filterBtn = (key: typeof filter, label: string, count: number) => (
    <Button
      variant={filter === key ? "default" : "outline"}
      size="sm"
      className="rounded-full"
      onClick={() => setFilter(key)}
      aria-pressed={filter === key}
    >
      {label}{" "}
      <span className="ml-1 tabular-nums text-muted-foreground">({count})</span>
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Repositories
        </h2>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter repositories"
        >
          {filterBtn("all", "All", repositories.length)}
          {filterBtn(
            "clean",
            "Clean",
            repositories.filter((r) => r.scanStatus === "clean").length
          )}
          {filterBtn(
            "issues",
            "Issues",
            repositories.filter((r) => r.scanStatus === "issues").length
          )}
          {filterBtn(
            "never",
            "Not scanned",
            repositories.filter((r) => r.scanStatus === "never").length
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRepositories.map((repo) => (
          <Card
            key={repo.id}
            className="transition-shadow duration-200 max-[prefers-reduced-motion:reduce]:transition-none hover:shadow-elevated"
          >
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Github
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <CardTitle className="text-lg text-card-foreground">
                      {repo.name}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-xs">
                        {repo.fullName}
                      </span>
                      {repo.private && (
                        <Badge variant="outline" className="text-[0.65rem]">
                          Private
                        </Badge>
                      )}
                      {repo.language && (
                        <Badge variant="secondary" className="text-[0.65rem]">
                          {repo.language}
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {getStatusIcon(repo.scanStatus)}
                  {getStatusBadge(repo)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  {repo.description && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {repo.lastScanned && (
                      <span>
                        Last scanned:{" "}
                        {new Date(repo.lastScanned).toLocaleDateString()}
                      </span>
                    )}
                    <span>
                      Updated:{" "}
                      {new Date(repo.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {repo.scanStatus === "issues" && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      {repo.secretsCount > 0 && (
                        <span className="text-destructive">
                          {repo.secretsCount} secret
                          {repo.secretsCount !== 1 ? "s" : ""}
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
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onSelectRepository(repo.id)}
                  >
                    View details
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onScanRepository(repo.id)}
                    disabled={isScanning || repo.scanStatus === "scanning"}
                  >
                    <Scan className="mr-1 h-4 w-4" aria-hidden />
                    Scan
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => window.open(repo.url, "_blank")}
                    aria-label={`Open ${repo.name} on GitHub`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRepositories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <Github
              className="h-12 w-12 text-muted-foreground"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="font-medium text-foreground">No repositories</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {filter === "all"
                  ? "We could not load any repositories. Check your GitHub permissions and try refreshing."
                  : `No repositories match the “${filter}” filter.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
