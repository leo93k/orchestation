"use client";

import { AlertCircle } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { WaterfallContainer } from "@/components/waterfall/WaterfallContainer";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2].map((i) => (
        <div key={i} className="border-b border-border pb-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-1 w-16" />
          </div>
          <div className="flex flex-col gap-0.5 pl-5">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-7 w-full rounded" />
            ))}
          </div>
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

export default function TaskPage() {
  const { groups, isLoading, error } = useTasks();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (groups.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-muted-foreground">No tasks registered.</p>
      </div>
    );
  }

  return <WaterfallContainer groups={groups} />;
}
