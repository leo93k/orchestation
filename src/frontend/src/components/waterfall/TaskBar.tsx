"use client";

import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";

type TaskBarProps = {
  task: WaterfallTask;
  onClick?: (task: WaterfallTask) => void;
};

export function TaskBar({ task, onClick }: TaskBarProps) {
  const statusStyle = STATUS_STYLES[task.status as TaskStatus];
  const priorityStyle =
    PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;

  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className={cn(
        "group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
        "hover:bg-muted/80 cursor-pointer border-b border-transparent hover:border-border",
      )}
    >
      {/* Status dot */}
      <span className={cn("status-dot", statusStyle.dot)} />

      <span className="shrink-0 font-mono text-[11px] text-muted-foreground w-20 truncate">
        {task.id}
      </span>
      <span className="truncate text-sm">{task.title}</span>

      {/* Priority badge */}
      <span
        className={cn(
          "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
          priorityStyle.bg,
          priorityStyle.text,
        )}
      >
        {priorityStyle.label}
      </span>

      {/* Role tag */}
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {task.role}
      </span>

      {/* Status label */}
      <span className="shrink-0 text-[10px] text-muted-foreground w-16 text-right">
        {statusStyle.label}
      </span>

      {/* Hover actions */}
      <span className="hover-actions flex items-center gap-1 shrink-0">
        <span className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 cursor-pointer">
          View
        </span>
      </span>
    </button>
  );
}
