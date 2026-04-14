"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Repository {
  id: string;
  name: string;
  scanStatus: string;
  secretsCount: number;
  dependencyRisks: number;
}

interface RiskChartProps {
  repositories: Repository[];
}

type ChartColors = {
  clean: string;
  secrets: string;
  deps: string;
  muted: string;
  barSecrets: string;
  barDeps: string;
};

function readChartColors(): ChartColors {
  if (typeof window === "undefined") {
    return {
      clean: "#34d399",
      secrets: "#f87171",
      deps: "#fbbf24",
      muted: "#64748b",
      barSecrets: "#f87171",
      barDeps: "#fbbf24",
    };
  }
  const root = document.documentElement;
  const s = getComputedStyle(root);
  const pick = (name: string, fallback: string) => {
    const v = s.getPropertyValue(name).trim();
    return v || fallback;
  };
  return {
    clean: pick("--chart-clean", "#34d399"),
    secrets: pick("--chart-secrets", "#f87171"),
    deps: pick("--chart-deps", "#fbbf24"),
    muted: pick("--chart-muted", "#64748b"),
    barSecrets: pick("--chart-bar-secrets", "#f87171"),
    barDeps: pick("--chart-bar-deps", "#fbbf24"),
  };
}

export function RiskChart({ repositories }: RiskChartProps) {
  const [colors, setColors] = useState<ChartColors>(() => readChartColors());

  useEffect(() => {
    setColors(readChartColors());
    const el = document.documentElement;
    const obs = new MutationObserver(() => setColors(readChartColors()));
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const riskData = [
    {
      name: "Clean",
      count: repositories.filter((r) => r.scanStatus === "clean").length,
      color: colors.clean,
    },
    {
      name: "Secrets",
      count: repositories.filter((r) => r.secretsCount > 0).length,
      color: colors.secrets,
    },
    {
      name: "Deps",
      count: repositories.filter((r) => r.dependencyRisks > 0).length,
      color: colors.deps,
    },
    {
      name: "Not scanned",
      count: repositories.filter((r) => r.scanStatus === "never").length,
      color: colors.muted,
    },
  ];

  const severityData = repositories
    .filter((r) => r.scanStatus === "issues")
    .map((r) => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + "…" : r.name,
      secrets: r.secretsCount,
      dependencies: r.dependencyRisks,
      total: r.secretsCount + r.dependencyRisks,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Risk distribution</CardTitle>
          <CardDescription>
            Status mix across repositories (last known scan).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] w-full min-h-[260px] overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart
                margin={{ top: 12, right: 12, bottom: 8, left: 12 }}
              >
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="46%"
                  labelLine={false}
                  label={({
                    cx,
                    cy,
                    midAngle,
                    innerRadius,
                    outerRadius,
                    percent,
                  }) => {
                    if (percent < 0.06) return null;
                    const RADIAN = Math.PI / 180;
                    const or =
                      typeof outerRadius === "number" && Number.isFinite(outerRadius)
                        ? outerRadius
                        : 72;
                    const ir =
                      typeof innerRadius === "number" && Number.isFinite(innerRadius)
                        ? innerRadius
                        : 0;
                    const r = or * 0.58 + ir * 0.42;
                    const x = cx + r * Math.cos(-midAngle * RADIAN);
                    const y = cy + r * Math.sin(-midAngle * RADIAN);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="hsl(var(--foreground))"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[11px] font-medium"
                      >
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                  outerRadius="62%"
                  dataKey="count"
                  nameKey="name"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius-md)",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ paddingTop: 8 }}
                  formatter={(value, entry) => {
                    const payload = entry.payload as { count?: number } | undefined;
                    const count =
                      typeof payload?.count === "number"
                        ? payload.count
                        : riskData.find((d) => d.name === value)?.count ?? 0;
                    return (
                      <span className="text-xs text-muted-foreground">
                        {value}
                        <span className="ml-1 tabular-nums text-foreground">
                          ({count})
                        </span>
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top repositories by issues</CardTitle>
          <CardDescription>
            Stacked secrets vs dependency flags (up to ten repos).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {severityData.length > 0 ? (
            <div className="h-[300px] w-full min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.6}
                  />
                  <XAxis
                    dataKey="name"
                    angle={-40}
                    textAnchor="end"
                    height={96}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius-md)",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar
                    dataKey="secrets"
                    stackId="a"
                    fill={colors.barSecrets}
                    name="Secrets"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="dependencies"
                    stackId="a"
                    fill={colors.barDeps}
                    name="Dependencies"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/30 py-14 text-center text-sm text-muted-foreground"
              role="status"
            >
              No repositories with open issues in this view.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
