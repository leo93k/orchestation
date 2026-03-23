"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SprintProgressProps = {
  title: string;
  done: number;
  total: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  className?: string;
};

export function SprintProgress({
  title,
  done,
  total,
  open,
  onOpenChange,
  children,
  className,
}: SprintProgressProps) {
  const [internalOpen, setInternalOpen] = React.useState(true);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = isControlled ? onOpenChange : setInternalOpen;

  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={cn("border-b border-border last:border-b-0", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-muted/30 transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}

          <span className="font-medium text-xs">{title}</span>

          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {done}/{total}
          </span>

          <Progress value={percentage} className="h-1 w-16 shrink-0" />

          <span className="text-[10px] text-muted-foreground">
            {percentage}%
          </span>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="pl-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
