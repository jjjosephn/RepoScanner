import { Skeleton } from "@/components/ui/skeleton";

/**
 * Session / full-page loading: structure is visible without relying on spin animation alone.
 */
export function PageLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" aria-hidden />
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="mx-auto h-4 w-48 max-w-[75%]" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
