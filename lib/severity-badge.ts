import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

/** Map secret/dependency severity strings to badge variants (shared with scan UI). */
export function severityToBadgeVariant(severity: string): BadgeVariant {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "warning";
    default:
      return "secondary";
  }
}
