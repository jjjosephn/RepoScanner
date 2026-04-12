import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Github, Key, Package, BarChart3 } from "lucide-react";

export interface SummaryStatCardsProps {
  totalRepositories: number;
  repositoriesScanned: number;
  secretsFound: number;
  dependencyRisks: number;
  securityScorePercent: string;
  /** Optional subtle motion when values change (marketing demo). */
  className?: string;
}

/**
 * Same layout as the signed-in dashboard summary row — used by Dashboard and marketing live demo.
 */
export function SummaryStatCards({
  totalRepositories,
  repositoriesScanned,
  secretsFound,
  dependencyRisks,
  securityScorePercent,
  className,
}: SummaryStatCardsProps) {
  return (
    <div
      className={`mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className ?? ""}`}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total repositories
          </CardTitle>
          <Github className="h-4 w-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <p className="font-display text-3xl font-semibold tabular-nums">
            {totalRepositories}
          </p>
          <p className="text-xs text-muted-foreground">
            {repositoriesScanned} scanned
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
            {secretsFound}
          </p>
          <p className="text-xs text-muted-foreground">Redacted detections</p>
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
            {dependencyRisks}
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
            {securityScorePercent}%
          </p>
          <p className="text-xs text-muted-foreground">
            Heuristic from findings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
