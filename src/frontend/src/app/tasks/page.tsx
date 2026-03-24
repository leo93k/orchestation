"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Square, Bot, Layers, ArrowDown, Clock, Loader2, GitBranch } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import type { WaterfallTask } from "@/types/waterfall";
import AutoImproveControl from "@/components/AutoImproveControl";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

const STATUS_ORDER = ["in_progress", "reviewing", "pending", "done", "rejected"];

const displayTaskId = (id: string) => id.replace(/^REQ-/, "TASK-");

function RequestCard({
  req,
  onUpdate,
  onDelete,
  onClick,
}: {
  req: RequestItem;
  onUpdate: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(req.title);
  const [editContent, setEditContent] = useState(req.content);
  const [editPriority, setEditPriority] = useState(req.priority);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [cardTab, setCardTab] = useState<"content" | "ai-result">("content");
  const isReadOnly = req.status === "done";
  useEffect(() => {
    if (expanded && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${req.id}/result`)
        .then((r) => r.json())
        .then((data) => setAiResult(data.result ?? ""))
        .catch(() => setAiResult(""))
        .finally(() => setAiResultLoading(false));
    }
  }, [expanded, aiResult, aiResultLoading, req.id]);

  const handleSave = async () => {
    await onUpdate(req.id, { title: editTitle, content: editContent, priority: editPriority });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (confirm(`${displayTaskId(req.id)} delete?`)) {
      await onDelete(req.id);
    }
  };

  return (
    <div className="board-card">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        {req.status === "in_progress" ? (
          <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[req.status])} />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="font-mono text-[11px] text-muted-foreground shrink-0 hover:text-primary hover:underline bg-transparent border-none cursor-pointer p-0"
        >
          {displayTaskId(req.id)}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-sm flex-1 truncate text-left hover:text-primary bg-transparent border-none cursor-pointer p-0"
        >
          {req.title}
        </button>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
          PRIORITY_COLORS[req.priority],
        )}>
          {req.priority}
        </span>
        {req.status === "in_progress" && (
          <button
            type="button"
            title="중지 → Pending"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(req.id, { status: "pending" });
            }}
            className="shrink-0 p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Square className="h-3 w-3" />
          </button>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">{req.created}</span>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1 mb-2 border-b border-border">
              <button
                type="button"
                onClick={() => setCardTab("content")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors",
                  cardTab === "content"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Content
              </button>
              <button
                type="button"
                onClick={() => setCardTab("ai-result")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors",
                  cardTab === "ai-result"
                    ? "border-blue-400 text-blue-400"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot className="h-3 w-3" />
                AI Result
              </button>
          </div>

          {cardTab === "content" && (
            <div style={{ minHeight: 150 }}>
              {editing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value as RequestItem["priority"])}
                      className="bg-muted border border-border rounded px-2 py-1 text-xs outline-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="filter-pill active text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setEditTitle(req.title);
                        setEditContent(req.content);
                        setEditPriority(req.priority);
                      }}
                      className="filter-pill text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.content || "(No description)"}</p>
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="filter-pill text-xs flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="filter-pill text-xs flex items-center gap-1 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {cardTab === "ai-result" && (
            <div style={{ minHeight: 150 }}>
              {aiResultLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : aiResult ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{aiResult}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No result available.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TAB_STACK = "stack";
const TAB_ALL = "all";
const TABS = [TAB_STACK, TAB_ALL, ...STATUS_ORDER] as const;

const TAB_LABEL: Record<string, string> = {
  stack: "Stack",
  all: "All",
  ...STATUS_LABEL,
};

/* ── Kanban Board (Stack View) ─────────────────────────── */

type ArrowDef = {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function KanbanCard({
  req,
  isDone,
  isRejected,
  onClick,
  cardRef,
}: {
  req: RequestItem;
  isDone?: boolean;
  isRejected?: boolean;
  onClick: () => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={cardRef}
      data-card-id={req.id}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 p-3 rounded-lg border cursor-pointer transition-all min-h-[64px]",
        "hover:shadow-md hover:border-primary/40",
        isDone && !isRejected && "opacity-55 border-border bg-background",
        isRejected && "opacity-55 border-red-500/30 bg-red-500/5",
        !isDone && !isRejected && "border-border bg-background hover:bg-muted",
      )}
    >
      <div className="flex items-center gap-2">
        {req.status === "in_progress" ? (
          <span className="w-2.5 h-2.5 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : isRejected ? (
          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-red-500" />
        ) : (
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", STATUS_DOT[req.status])} />
        )}
        <span className="font-mono text-[11px] text-muted-foreground shrink-0">
          {displayTaskId(req.id)}
        </span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ml-auto",
          PRIORITY_COLORS[req.priority],
        )}>
          {req.priority}
        </span>
      </div>
      <span className="text-sm leading-snug line-clamp-2">{req.title}</span>
    </div>
  );
}

function KanbanBoard({
  requests,
  tasks,
  onClickItem,
}: {
  requests: RequestItem[];
  tasks: WaterfallTask[];
  onClickItem: (req: RequestItem) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [arrows, setArrows] = useState<ArrowDef[]>([]);
  const [hoveredArrow, setHoveredArrow] = useState<string | null>(null);

  // Column data
  const doneItems = requests.filter((r) => r.status === "done" || r.status === "rejected");
  const currentItems = requests.filter((r) => r.status === "in_progress" || r.status === "reviewing");
  const pendingItems = requests.filter((r) => r.status === "pending");

  // Build dependency map: REQ-XXX depends on REQ-YYY
  // WaterfallTask uses TASK-XXX ids, requests use REQ-XXX ids
  const taskToReq = (taskId: string) => taskId.replace(/^TASK-/, "REQ-");
  const reqToTask = (reqId: string) => reqId.replace(/^REQ-/, "TASK-");

  // Build deps: for each request, find its WaterfallTask and get depends_on
  const depEdges: { from: string; to: string }[] = [];
  const reqIds = new Set(requests.map((r) => r.id));
  for (const req of requests) {
    const wt = tasks.find((t) => t.id === reqToTask(req.id));
    if (wt) {
      for (const dep of wt.depends_on) {
        const depReqId = taskToReq(dep);
        if (reqIds.has(depReqId)) {
          // dep (source) -> req (target that depends on source)
          depEdges.push({ from: depReqId, to: req.id });
        }
      }
    }
  }

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  // Calculate arrow positions
  const recalcArrows = useCallback(() => {
    if (!boardRef.current || depEdges.length === 0) {
      setArrows([]);
      return;
    }
    const boardRect = boardRef.current.getBoundingClientRect();
    const newArrows: ArrowDef[] = [];

    for (const edge of depEdges) {
      const fromEl = cardRefs.current.get(edge.from);
      const toEl = cardRefs.current.get(edge.to);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      newArrows.push({
        fromId: edge.from,
        toId: edge.to,
        x1: fromRect.right - boardRect.left,
        y1: fromRect.top + fromRect.height / 2 - boardRect.top,
        x2: toRect.left - boardRect.left,
        y2: toRect.top + toRect.height / 2 - boardRect.top,
      });
    }
    setArrows(newArrows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, tasks]);

  useEffect(() => {
    // Recalculate after render
    const timer = setTimeout(recalcArrows, 100);
    return () => clearTimeout(timer);
  }, [recalcArrows]);

  useEffect(() => {
    if (!boardRef.current) return;
    const observer = new ResizeObserver(() => recalcArrows());
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, [recalcArrows]);

  const totalCount = doneItems.length + currentItems.length + pendingItems.length;

  if (totalCount === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No tasks yet.</p>
        <p className="text-xs mt-1">Create a new task to see the kanban board.</p>
      </div>
    );
  }

  const columns = [
    {
      key: "done",
      label: "DONE",
      count: doneItems.length,
      items: doneItems,
      dotClass: "bg-emerald-500",
      headerBg: "bg-emerald-600/80",
      spinner: false,
    },
    {
      key: "current",
      label: "CURRENT",
      count: currentItems.length,
      items: currentItems,
      dotClass: "bg-blue-500",
      headerBg: "bg-blue-600/80",
      spinner: true,
    },
    {
      key: "pending",
      label: "PENDING",
      count: pendingItems.length,
      items: pendingItems,
      dotClass: "bg-yellow-500",
      headerBg: "bg-yellow-600/80",
      spinner: false,
    },
  ];

  return (
    <div ref={boardRef} className="relative w-full">
      {/* SVG arrow overlay */}
      {arrows.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <defs>
            <marker
              id="kanban-arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-muted-foreground" />
            </marker>
            <marker
              id="kanban-arrowhead-hover"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-primary" />
            </marker>
          </defs>
          {arrows.map((a) => {
            const key = `${a.fromId}-${a.toId}`;
            const isHovered = hoveredArrow === key;
            const dx = a.x2 - a.x1;
            const cpOffset = Math.max(Math.abs(dx) * 0.4, 30);
            const path = `M ${a.x1} ${a.y1} C ${a.x1 + cpOffset} ${a.y1}, ${a.x2 - cpOffset} ${a.y2}, ${a.x2} ${a.y2}`;
            return (
              <g key={key}>
                {/* Invisible wide hit area for hover */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredArrow(key)}
                  onMouseLeave={() => setHoveredArrow(null)}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={isHovered ? "var(--primary)" : "var(--muted-foreground)"}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeDasharray={isHovered ? "none" : "4 3"}
                  opacity={isHovered ? 0.9 : 0.35}
                  markerEnd={isHovered ? "url(#kanban-arrowhead-hover)" : "url(#kanban-arrowhead)"}
                  style={{ transition: "all 0.15s ease" }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 200 }}>
        {columns.map((col) => (
          <div
            key={col.key}
            className="flex flex-col rounded-lg border border-border bg-card overflow-hidden"
            style={{ minHeight: 200 }}
          >
            {/* Column header */}
            <div className={cn("flex items-center gap-2 px-3 py-2", col.headerBg)}>
              {col.spinner && col.count > 0 ? (
                <Loader2 className="h-3 w-3 text-white animate-spin shrink-0" />
              ) : (
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", col.key === "done" ? "bg-white/70" : col.key === "pending" ? "bg-white/70" : "bg-white/70")} />
              )}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
                {col.label}
              </span>
              <span className="ml-auto text-[10px] font-medium text-white/70 bg-white/20 rounded-full px-2 py-0.5">
                {col.count}
              </span>
            </div>

            {/* Column body */}
            <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
              {col.items.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground/50 py-6">
                  No tasks
                </div>
              )}
              {col.items.map((req) => (
                <KanbanCard
                  key={req.id}
                  req={req}
                  isDone={req.status === "done" || req.status === "rejected"}
                  isRejected={req.status === "rejected"}
                  onClick={() => onClickItem(req)}
                  cardRef={setCardRef(req.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPageInner() {
  const { requests, isLoading, error, updateRequest, deleteRequest } = useRequests();
  const { groups } = useTasks();
  const allWaterfallTasks = groups.flatMap((g) => g.tasks);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || TAB_STACK;

  const setActiveTab = (tab: string) => {
    router.push(`/tasks?tab=${tab}`, { scroll: false });
  };

  const grouped: Record<string, RequestItem[]> = {
    pending: requests.filter((r) => r.status === "pending"),
    reviewing: requests.filter((r) => r.status === "reviewing"),
    in_progress: requests.filter((r) => r.status === "in_progress"),
    rejected: requests.filter((r) => r.status === "rejected"),
    done: requests.filter((r) => r.status === "done"),
  };

  const filteredStatuses = activeTab === TAB_ALL
    ? STATUS_ORDER.filter((s) => grouped[s].length > 0)
    : [activeTab];

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Tasks</h1>
          <AutoImproveControl />
        </div>
        <button
          type="button"
          onClick={() => router.push("/tasks/new")}
          className="filter-pill active flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          New Task
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const count = tab === TAB_ALL
            ? requests.length
            : tab === TAB_STACK
              ? (grouped.in_progress?.length ?? 0) + (grouped.reviewing?.length ?? 0) + (grouped.pending?.length ?? 0)
              : grouped[tab]?.length ?? 0;
          return (
            <span key={tab} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab
                    ? tab === TAB_STACK
                      ? "border-violet-400 text-violet-400"
                      : "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === TAB_STACK && (
                  <Layers className="h-3 w-3 shrink-0" />
                )}
                {tab !== TAB_ALL && tab !== TAB_STACK && (
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[tab])} />
                )}
                {TAB_LABEL[tab]}
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </button>
              {tab === TAB_STACK && (
                <span className="h-4 w-px bg-border mx-1" />
              )}
            </span>
          );
        })}
      </div>

      {activeTab === TAB_STACK && (
        <KanbanBoard
          requests={requests}
          tasks={allWaterfallTasks}
          onClickItem={(req) => router.push(`/tasks/${displayTaskId(req.id)}`)}
        />
      )}

      {activeTab !== TAB_STACK && filteredStatuses.map((status) => {
        const items = grouped[status];
        if (!items || items.length === 0) return null;
        return (
          <div key={status}>
            {activeTab === TAB_ALL && (
              <div className="flex items-center gap-2 mb-2">
                {status === "in_progress" ? (
                  <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-[10px] text-muted-foreground">({items.length})</span>
              </div>
            )}
            <div className="space-y-1">
              {items.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  onUpdate={updateRequest}
                  onDelete={deleteRequest}
                  onClick={() => router.push(`/tasks/${displayTaskId(req.id)}`)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {activeTab !== TAB_STACK && requests.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No tasks yet. Click &quot;New Task&quot; to create a task.</p>
        </div>
      )}

      {activeTab !== TAB_ALL && activeTab !== TAB_STACK && (grouped[activeTab]?.length ?? 0) === 0 && requests.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No {TAB_LABEL[activeTab]} tasks.</p>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <TasksPageInner />
    </Suspense>
  );
}
