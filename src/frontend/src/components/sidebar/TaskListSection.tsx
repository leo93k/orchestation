"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Square,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_STYLES,
  type TaskStatus,
} from "../../../lib/constants";
import type { RequestItem } from "@/store/tasksStore";

/* ── Props ── */

export interface TaskListSectionProps {
  requestItems: RequestItem[];
  currentPath: string;
  onStopTask?: (id: string) => Promise<void>;
}

/* ── Component ── */

export function TaskListSection({
  requestItems,
  currentPath,
  onStopTask,
}: TaskListSectionProps) {
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);

  // 사이드바 태스크: updated 내림차순으로 최근 10개
  const uniqueItems = [...new Map(requestItems.map((r) => [r.id, r])).values()];
  const recentItems = uniqueItems
    .sort((a, b) => (b.updated ?? b.created).localeCompare(a.updated ?? a.created))
    .slice(0, 10);

  return (
    <div className="mb-2">
      <div className="sidebar-section-sep" />
      <div className="px-2 mb-1.5 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1 sidebar-section-link bg-transparent border-none p-0 cursor-pointer"
          onClick={() => setTasksExpanded((v) => !v)}
        >
          <ChevronDown
            className="h-3 w-3 transition-transform duration-200"
            style={{ transform: tasksExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <Link
            href="/tasks"
            className={cn("sidebar-section-link", currentPath.startsWith("/tasks") && "active")}
            onClick={(e) => e.stopPropagation()}
          >
            Tasks
          </Link>
        </button>
        <span className={cn("text-[10px] font-medium tabular-nums px-1 rounded", currentPath.startsWith("/tasks") ? "text-primary" : "text-muted-foreground")}>
          {requestItems.length}
        </span>
      </div>

      {/* Collapsible tasks content */}
      <div className={cn("sidebar-collapsible", tasksExpanded && "sidebar-collapsible-open")}>
      <div className="sidebar-collapsible-inner">

      {/* 최근 업데이트 순 10개 태스크 */}
      {recentItems.map((task) => {
        const taskDisplayId = task.id;
        const isExpanded = expandedTaskId === task.id;
        const isDone = task.status === "done";
        const isInProgress = task.status === "in_progress";
        const statusIndicator = isInProgress
          ? <span className="w-3 h-3 shrink-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          : isDone
          ? <span className="text-emerald-500 text-xs shrink-0">&#10003;</span>
          : task.status === "reviewing"
          ? <span className="w-2 h-2 rounded-full shrink-0 bg-orange-500" />
          : task.status === "pending"
          ? <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
          : task.status === "stopped"
          ? <span className="w-2 h-2 rounded-full shrink-0 bg-violet-500" />
          : <span className="w-2 h-2 rounded-full shrink-0 bg-red-500" />;
        return (
          <div key={task.id} className="group relative">
            <button
              type="button"
              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
              className={cn(
                "tree-item w-full text-left",
                isInProgress && "pr-7",
                currentPath === `/tasks/${taskDisplayId}` && "active"
              )}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              {statusIndicator}
              <span className={cn("truncate flex-1 text-xs", isDone && "text-muted-foreground line-through")}>
                {taskDisplayId} {task.title}
              </span>
            </button>
            {isInProgress && onStopTask && (
              stoppingTaskId === task.id ? (
                <span className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-red-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                </span>
              ) : (
                <button
                  type="button"
                  title="중지"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setStoppingTaskId(task.id);
                    try { await onStopTask(task.id); } finally { setStoppingTaskId(null); }
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Square className="h-2.5 w-2.5" />
                </button>
              )
            )}
            {isExpanded && (
              <Link
                href={`/tasks/${taskDisplayId}`}
                className={cn(
                  "block mr-1 my-0.5 px-2 py-1.5 rounded text-[11px] text-muted-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent hover:text-foreground no-underline transition-colors",
                  isDone ? "ml-9" : "ml-6"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn("px-1 py-0 rounded text-[9px] font-medium", STATUS_STYLES[task.status as TaskStatus]?.bg || "bg-muted", "text-white")}>
                    {task.status}
                  </span>
                </div>
                <p className="truncate">{task.title}</p>
                <span className="text-[10px] text-muted-foreground/70">Click to open detail →</span>
              </Link>
            )}
          </div>
        );
      })}

      {/* + New Task button */}
      <Link
        href="/tasks/new"
        className={cn("tree-item w-full text-left text-muted-foreground hover:text-foreground no-underline", currentPath === "/tasks/new" && "active")}
      >
        <Plus className="h-3 w-3 shrink-0" />
        <span className="text-xs">New Task</span>
      </Link>

      {requestItems.length === 0 && (
        <div className="px-2 py-2 text-[11px] text-muted-foreground">
          No tasks yet
        </div>
      )}

      </div>
      </div>
    </div>
  );
}
