"use client";

import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  type TaskStatus,
  type TaskPriority,
} from "../../lib/constants";
import type { WaterfallTask } from "@/types/waterfall";
import { MousePointerClick } from "lucide-react";

type RightPanelProps = {
  task: WaterfallTask | null;
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-section">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function IdChip({ id }: { id: string }) {
  return (
    <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] mr-1 mb-1">
      {id}
    </span>
  );
}

export function RightPanel({ task }: RightPanelProps) {
  if (!task) {
    return (
      <div className="ide-right flex flex-col items-center justify-center h-full text-muted-foreground">
        <MousePointerClick className="h-6 w-6 mb-2 opacity-40" />
        <p className="text-xs">Select a task</p>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[task.status as TaskStatus];
  const priorityStyle =
    PRIORITY_STYLES[task.priority as TaskPriority] ?? PRIORITY_STYLES.medium;

  return (
    <div className="ide-right">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <div className="font-mono text-[11px] text-muted-foreground mb-1">{task.id}</div>
        <div className="text-sm font-semibold leading-tight">{task.title}</div>
      </div>

      {/* Status */}
      <Section label="Status">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusStyle.bg,
            "text-white",
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", statusStyle.dot)} />
          {statusStyle.label}
        </span>
      </Section>

      {/* Priority */}
      <Section label="Priority">
        <span
          className={cn(
            "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
            priorityStyle.bg,
            priorityStyle.text,
          )}
        >
          {priorityStyle.label}
        </span>
      </Section>

      {/* Role */}
      <Section label="Role">
        <span className="text-sm">{task.role || "-"}</span>
      </Section>

      {/* Sprint */}
      <Section label="Sprint">
        <span className="text-sm">{task.sprint || "-"}</span>
      </Section>

      {/* Dependencies */}
      <Section label="Depends On">
        {task.depends_on.length > 0 ? (
          <div className="flex flex-wrap">
            {task.depends_on.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>

      {/* Blocks */}
      <Section label="Blocks">
        {task.blocks.length > 0 ? (
          <div className="flex flex-wrap">
            {task.blocks.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>

      {/* Parallel With */}
      <Section label="Parallel With">
        {task.parallel_with.length > 0 ? (
          <div className="flex flex-wrap">
            {task.parallel_with.map((id) => (
              <IdChip key={id} id={id} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>

      {/* Affected Files */}
      <Section label="Files">
        {task.affected_files.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {task.affected_files.map((file) => (
              <div
                key={file}
                className="truncate rounded bg-muted px-2 py-0.5 font-mono text-[11px]"
              >
                {file}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Section>
    </div>
  );
}
