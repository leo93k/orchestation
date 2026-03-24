"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { RequestItem } from "@/hooks/useRequests";
import type { WaterfallTask } from "@/types/waterfall";

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  stopped: "#8b5cf6",
  in_progress: "#3b82f6",
  reviewing: "#f97316",
  done: "#22c55e",
  rejected: "#ef4444",
};

const STATUS_BG: Record<string, string> = {
  pending: "bg-yellow-500/20",
  stopped: "bg-violet-500/20",
  in_progress: "bg-blue-500/20",
  reviewing: "bg-orange-500/20",
  done: "bg-emerald-500/20",
  rejected: "bg-red-500/20",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;
const DAY_WIDTH = 48;
const SIDEBAR_WIDTH = 280;

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date();
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

type TimelineTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  start: Date;
  end: Date;
  depends_on: string[];
};

export default function TimelineView({
  requests,
  tasks,
  onClickItem,
  priorityFilter,
}: {
  requests: RequestItem[];
  tasks: WaterfallTask[];
  onClickItem: (req: RequestItem) => void;
  priorityFilter: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const timelineTasks: TimelineTask[] = useMemo(() => {
    const now = new Date();
    let filtered = requests;
    if (priorityFilter !== "all") {
      filtered = filtered.filter((r) => r.priority === priorityFilter);
    }
    return filtered.map((r) => {
      const wt = taskMap.get(r.id);
      const start = startOfDay(parseDate(r.created));
      const endDate = r.status === "done" || r.status === "rejected"
        ? startOfDay(parseDate(r.updated))
        : startOfDay(now);
      const end = endDate <= start ? addDays(start, 1) : endDate;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        start,
        end,
        depends_on: wt?.depends_on ?? [],
      };
    });
  }, [requests, taskMap, priorityFilter]);

  // Compute date range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (timelineTasks.length === 0) {
      const now = startOfDay(new Date());
      return { minDate: addDays(now, -7), maxDate: addDays(now, 7), totalDays: 14 };
    }
    const starts = timelineTasks.map((t) => t.start.getTime());
    const ends = timelineTasks.map((t) => t.end.getTime());
    const min = startOfDay(new Date(Math.min(...starts)));
    const max = startOfDay(new Date(Math.max(...ends)));
    const padded = addDays(min, -2);
    const paddedMax = addDays(max, 3);
    const days = daysBetween(padded, paddedMax);
    return { minDate: padded, maxDate: paddedMax, totalDays: Math.max(days, 7) };
  }, [timelineTasks]);

  // Generate day columns
  const dayColumns = useMemo(() => {
    const cols: { date: Date; x: number; isWeekend: boolean; isToday: boolean; monthStart: boolean }[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(minDate, i);
      cols.push({
        date: d,
        x: i * DAY_WIDTH,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: d.getTime() === today.getTime(),
        monthStart: d.getDate() === 1,
      });
    }
    return cols;
  }, [minDate, totalDays]);

  // Scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const today = startOfDay(new Date());
    const todayOffset = daysBetween(minDate, today);
    const scrollTo = Math.max(0, todayOffset * DAY_WIDTH - scrollRef.current.clientWidth / 2);
    scrollRef.current.scrollLeft = scrollTo;
  }, [minDate]);

  // Drag to scroll
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
      scrollRef.current.style.userSelect = "";
    }
  }, []);

  // Sort tasks: in_progress first, then pending, reviewing, done, rejected
  const statusOrder: Record<string, number> = { in_progress: 0, reviewing: 1, pending: 2, done: 3, rejected: 4 };
  const sortedTasks = useMemo(() =>
    [...timelineTasks].sort((a, b) => (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5) || a.id.localeCompare(b.id)),
    [timelineTasks]
  );

  const taskIndexMap = useMemo(() => new Map(sortedTasks.map((t, i) => [t.id, i])), [sortedTasks]);

  // Dependency arrows
  const arrows = useMemo(() => {
    const result: { fromX: number; fromY: number; toX: number; toY: number; id: string }[] = [];
    const taskIdSet = new Set(sortedTasks.map((t) => t.id));
    for (const task of sortedTasks) {
      const toIdx = taskIndexMap.get(task.id);
      if (toIdx === undefined) continue;
      for (const depId of task.depends_on) {
        if (!taskIdSet.has(depId)) continue;
        const fromIdx = taskIndexMap.get(depId);
        if (fromIdx === undefined) continue;
        const fromTask = sortedTasks[fromIdx];
        const fromEndDays = daysBetween(minDate, fromTask.end);
        const toStartDays = daysBetween(minDate, task.start);
        result.push({
          fromX: fromEndDays * DAY_WIDTH,
          fromY: fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          toX: toStartDays * DAY_WIDTH,
          toY: toIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          id: `${depId}->${task.id}`,
        });
      }
    }
    return result;
  }, [sortedTasks, taskIndexMap, minDate]);

  const contentHeight = sortedTasks.length * ROW_HEIGHT;
  const contentWidth = totalDays * DAY_WIDTH;

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No tasks to display.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-muted/30">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
            {status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        ))}
      </div>
      <div className="flex" style={{ height: "calc(100% - 30px)" }}>
        {/* Sidebar - task list */}
        <div className="shrink-0 border-r border-border" style={{ width: SIDEBAR_WIDTH }}>
          {/* Sidebar header */}
          <div className="flex items-center px-3 border-b border-border bg-muted/50" style={{ height: HEADER_HEIGHT }}>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Task</span>
          </div>
          {/* Sidebar rows */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            {sortedTasks.map((task) => {
              const req = requests.find((r) => r.id === task.id);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-2 px-3 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => req && onClickItem(req)}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: STATUS_COLORS[task.status] ?? "#888" }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 group-hover:text-primary group-hover:underline">
                    {task.id}
                  </span>
                  <span className="text-[11px] truncate flex-1 group-hover:text-primary">
                    {task.title}
                  </span>
                  <span className={cn("text-[9px] px-1 py-0.5 rounded border font-medium shrink-0", PRIORITY_COLORS[task.priority])}>
                    {task.priority}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Timeline area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          style={{ cursor: "grab" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div style={{ width: contentWidth, minHeight: "100%" }} className="relative">
            {/* Date header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border" style={{ height: HEADER_HEIGHT }}>
              <div className="relative" style={{ height: HEADER_HEIGHT }}>
                {dayColumns.map((col) => (
                  <div
                    key={col.x}
                    className={cn(
                      "absolute top-0 flex flex-col items-center justify-center border-r border-border/30",
                      col.isToday && "bg-primary/10",
                      col.isWeekend && "bg-muted/40",
                    )}
                    style={{ left: col.x, width: DAY_WIDTH, height: HEADER_HEIGHT }}
                  >
                    {col.monthStart && (
                      <span className="text-[9px] font-medium text-primary">{formatMonthYear(col.date)}</span>
                    )}
                    <span className={cn(
                      "text-[10px]",
                      col.isToday ? "font-bold text-primary" : col.isWeekend ? "text-muted-foreground/50" : "text-muted-foreground",
                    )}>
                      {formatDate(col.date)}
                    </span>
                    <span className={cn(
                      "text-[9px]",
                      col.isToday ? "text-primary" : "text-muted-foreground/40",
                    )}>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][col.date.getDay()]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Grid body */}
            <div className="relative" style={{ height: contentHeight }}>
              {/* Day column backgrounds */}
              {dayColumns.map((col) => (
                <div
                  key={`bg-${col.x}`}
                  className={cn(
                    "absolute top-0 border-r border-border/10",
                    col.isToday && "bg-primary/5",
                    col.isWeekend && !col.isToday && "bg-muted/20",
                  )}
                  style={{ left: col.x, width: DAY_WIDTH, height: contentHeight }}
                />
              ))}
              {/* Today line */}
              {dayColumns.filter((c) => c.isToday).map((col) => (
                <div
                  key="today-line"
                  className="absolute top-0 z-[5] border-l-2 border-primary/60"
                  style={{ left: col.x + DAY_WIDTH / 2, height: contentHeight }}
                >
                  <div className="absolute -top-1 -left-[5px] w-[10px] h-[10px] rounded-full bg-primary/60" />
                </div>
              ))}
              {/* Row backgrounds */}
              {sortedTasks.map((_, i) => (
                <div
                  key={`row-${i}`}
                  className={cn("absolute border-b border-border/20", i % 2 === 1 && "bg-muted/10")}
                  style={{ top: i * ROW_HEIGHT, left: 0, width: contentWidth, height: ROW_HEIGHT }}
                />
              ))}
              {/* SVG for arrows */}
              {arrows.length > 0 && (
                <svg
                  className="absolute top-0 left-0 z-[3] pointer-events-none"
                  style={{ width: contentWidth, height: contentHeight }}
                >
                  <defs>
                    <marker
                      id="timeline-arrow"
                      markerWidth="6"
                      markerHeight="4"
                      refX="5"
                      refY="2"
                      orient="auto"
                    >
                      <polygon points="0 0, 6 2, 0 4" fill="var(--muted-foreground)" opacity="0.5" />
                    </marker>
                  </defs>
                  {arrows.map((a) => {
                    const cp = Math.max(Math.abs(a.toX - a.fromX) * 0.4, 30);
                    const path = `M ${a.fromX} ${a.fromY} C ${a.fromX + cp} ${a.fromY}, ${a.toX - cp} ${a.toY}, ${a.toX} ${a.toY}`;
                    return (
                      <path
                        key={a.id}
                        d={path}
                        fill="none"
                        stroke="var(--muted-foreground)"
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        opacity={0.35}
                        markerEnd="url(#timeline-arrow)"
                      />
                    );
                  })}
                </svg>
              )}
              {/* Task bars */}
              {sortedTasks.map((task, i) => {
                const startDays = daysBetween(minDate, task.start);
                const duration = Math.max(daysBetween(task.start, task.end), 1);
                const barLeft = startDays * DAY_WIDTH;
                const barWidth = Math.max(duration * DAY_WIDTH, DAY_WIDTH * 0.5);
                const color = STATUS_COLORS[task.status] ?? "#888";
                return (
                  <div
                    key={task.id}
                    className="absolute z-[4] group/bar"
                    style={{
                      top: i * ROW_HEIGHT + 8,
                      left: barLeft,
                      width: barWidth,
                      height: ROW_HEIGHT - 16,
                    }}
                  >
                    <div
                      className="w-full h-full rounded-md transition-all group-hover/bar:brightness-110 group-hover/bar:shadow-md"
                      style={{
                        background: `linear-gradient(90deg, ${color}cc, ${color}99)`,
                        border: `1px solid ${color}`,
                      }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/bar:block z-20 pointer-events-none">
                      <div className="bg-popover border border-border rounded-md px-2 py-1 shadow-lg whitespace-nowrap">
                        <div className="text-[10px] font-mono text-muted-foreground">{task.id}</div>
                        <div className="text-[11px] font-medium">{task.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDate(task.start)} — {formatDate(task.end)} ({daysBetween(task.start, task.end)}d)
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
