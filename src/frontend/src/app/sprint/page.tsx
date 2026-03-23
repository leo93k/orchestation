"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useSprints } from "@/hooks/useSprints";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const SPRINT_STATUS_DOT: Record<string, string> = {
  ready: "bg-zinc-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

function StatusDot({ status }: { status: string }) {
  const color = SPRINT_STATUS_DOT[status] ?? "bg-gray-400";
  return <span className={`status-dot ${color}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2 border-b border-border">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-1 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-8 text-center">
      <p className="text-xs text-muted-foreground">No sprints registered.</p>
    </div>
  );
}

export default function SprintListPage() {
  const { sprints, isLoading, error } = useSprints();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (sprints.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col">
      {/* Table header */}
      <div className="flex items-center gap-3 px-2 py-1.5 border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <span className="w-2" />
        <span className="flex-1">Sprint</span>
        <span className="w-20 text-right">Progress</span>
        <span className="w-16" />
        <span className="w-16 text-right">Status</span>
      </div>

      {/* Sprint rows */}
      {sprints.map((sprint) => {
        const percentage =
          sprint.progress.total > 0
            ? Math.round(
                (sprint.progress.done / sprint.progress.total) * 100,
              )
            : 0;

        return (
          <Link
            key={sprint.id}
            href={`/sprint/${sprint.id}`}
            className="group flex items-center gap-3 px-2 py-2 border-b border-border transition-colors hover:bg-muted/50"
          >
            <StatusDot status={sprint.status} />
            <span className="flex-1 text-sm font-medium truncate">{sprint.title}</span>
            <span className="w-20 text-right text-[11px] text-muted-foreground">
              {sprint.progress.done}/{sprint.progress.total}
            </span>
            <Progress value={percentage} className="h-1 w-16 shrink-0" />
            <span className="w-16 text-right text-[10px] text-muted-foreground capitalize">
              {sprint.status.replace("_", " ")}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
