"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Pencil, Check, X, Plus, Trash2 } from "lucide-react";

interface AnalyzedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  criteria: string[];
  scope?: string[];
  depends_on?: number[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

type Step = "input" | "preview";

export default function NewTaskPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AnalyzedTask[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleAnalyze = async () => {
    if (!title.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch("/api/tasks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      setTasks(data.tasks);
      setStep("preview");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const createdIds: string[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const content = [
          task.description,
          "",
          "## Completion Criteria",
          ...task.criteria.map((c) => `- ${c}`),
        ].join("\n");

        // Resolve depends_on indices to actual TASK IDs
        const dependsOn = (task.depends_on ?? [])
          .filter((idx) => idx >= 0 && idx < createdIds.length)
          .map((idx) => createdIds[idx]);

        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            content,
            priority: task.priority,
            scope: task.scope ?? [],
            depends_on: dependsOn,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to create task");
        }
        const created = await res.json();
        createdIds.push(created.id);
      }
      router.push("/tasks");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to create tasks");
    } finally {
      setConfirming(false);
    }
  };

  const updateTask = (idx: number, updates: Partial<AnalyzedTask>) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)),
    );
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const addTask = () => {
    setTasks((prev) => [
      ...prev,
      { title: "", description: "", priority: "medium", criteria: [""] },
    ]);
    setEditingIdx(tasks.length);
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === "preview") {
              setStep("input");
            } else {
              router.push("/tasks");
            }
          }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            {step === "input" ? "New Task" : "AI Analysis Result"}
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {step === "input" ? "AI가 Task를 분해하고 우선순위를 설정합니다" : `${tasks.length}개 Task로 분해됨 — 수정 후 컨펌하세요`}
          </p>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", step === "input" ? "text-primary" : "text-muted-foreground")}>
            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === "input" ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white")}>
              {step === "input" ? "1" : <Check className="h-3 w-3" />}
            </span>
            입력
          </div>
          <div className="h-px w-4 bg-border" />
          <div className={cn("flex items-center gap-1.5 text-[11px] font-medium", step === "preview" ? "text-primary" : "text-muted-foreground/50")}>
            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === "preview" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border")}>
              2
            </span>
            확인
          </div>
        </div>
      </div>

      {/* Step 1: Input */}
      {step === "input" && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              What needs to be done?
            </label>
            <input
              type="text"
              placeholder="Task 제목을 입력하세요..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) handleAnalyze();
              }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">
              Details <span className="text-muted-foreground font-normal">(선택사항)</span>
            </label>
            <textarea
              placeholder="Task에 대해 더 자세히 설명해 주세요..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y placeholder:text-muted-foreground/40"
            />
          </div>

          {analyzeError && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              {analyzeError}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="filter-pill text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!title.trim() || analyzing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                title.trim() && !analyzing
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI 분석 중...
                </>
              ) : (
                <>
                  AI로 분석하기
                  <span className="opacity-60">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: AI Preview */}
      {step === "preview" && (
        <div className="space-y-3">
          {/* Original input display */}
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="section-label mb-1.5">원본 입력</div>
            <div className="text-sm font-semibold">{title}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">{description}</div>
            )}
          </div>

          {tasks.map((task, idx) => (
            <TaskPreviewCard
              key={idx}
              task={task}
              index={idx}
              isEditing={editingIdx === idx}
              onEdit={() => setEditingIdx(editingIdx === idx ? null : idx)}
              onUpdate={(updates) => updateTask(idx, updates)}
              onRemove={() => removeTask(idx)}
              totalTasks={tasks.length}
            />
          ))}

          <button
            type="button"
            onClick={addTask}
            className="w-full rounded-xl border-2 border-dashed border-border/60 bg-transparent p-4 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/[0.02] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Task 추가
          </button>

          {analyzeError && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2.5 border border-red-500/20">
              {analyzeError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="filter-pill text-xs"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("input")}
                className="filter-pill text-xs"
              >
                ← 다시 입력
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming || tasks.length === 0 || tasks.some((t) => !t.title.trim())}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                  !confirming && tasks.length > 0 && tasks.every((t) => t.title.trim())
                    ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {tasks.length}개 Task 생성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskPreviewCard({
  task,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onRemove,
  totalTasks,
}: {
  task: AnalyzedTask;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<AnalyzedTask>) => void;
  onRemove: () => void;
  totalTasks: number;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3 transition-all",
      isEditing ? "border-primary/50 shadow-sm ring-1 ring-primary/10" : "border-border hover:border-border/80",
    )}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        {/* Step badge */}
        {totalTasks > 1 && (
          <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
            {index + 1}
          </span>
        )}
        {index > 0 && totalTasks > 1 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            ← Step {index} 이후
          </span>
        )}
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border font-semibold leading-none",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {task.priority}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "p-1.5 rounded-md transition-colors text-xs font-medium",
            isEditing ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground",
          )}
          title={isEditing ? "완료" : "편집"}
        >
          {isEditing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
        </button>
        {totalTasks > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title="삭제"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={task.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Task title..."
            className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-primary"
            autoFocus
          />
          <textarea
            value={task.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description..."
            rows={3}
            className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-primary resize-y"
          />
          <select
            value={task.priority}
            onChange={(e) =>
              onUpdate({ priority: e.target.value as AnalyzedTask["priority"] })
            }
            className="bg-muted border border-border rounded px-2 py-1 text-xs outline-none"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Completion Criteria
            </label>
            {task.criteria.map((c, ci) => (
              <div key={ci} className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground text-xs">-</span>
                <input
                  type="text"
                  value={c}
                  onChange={(e) => {
                    const newCriteria = [...task.criteria];
                    newCriteria[ci] = e.target.value;
                    onUpdate({ criteria: newCriteria });
                  }}
                  className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newCriteria = task.criteria.filter((_, i) => i !== ci);
                    onUpdate({ criteria: newCriteria });
                  }}
                  className="p-0.5 text-muted-foreground hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdate({ criteria: [...task.criteria, ""] })}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" />
              Add criterion
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Scope (작업 범위 파일)
            </label>
            {(task.scope ?? []).map((s, si) => (
              <div key={si} className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground text-xs">-</span>
                <input
                  type="text"
                  value={s}
                  onChange={(e) => {
                    const newScope = [...(task.scope ?? [])];
                    newScope[si] = e.target.value;
                    onUpdate({ scope: newScope });
                  }}
                  className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newScope = (task.scope ?? []).filter((_, i) => i !== si);
                    onUpdate({ scope: newScope });
                  }}
                  className="p-0.5 text-muted-foreground hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdate({ scope: [...(task.scope ?? []), ""] })}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" />
              Add file
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold leading-snug">
            {task.title || <span className="text-muted-foreground italic">(Untitled)</span>}
          </h3>
          {task.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{task.description}</p>
          )}
          {task.criteria.length > 0 && (
            <div>
              <span className="section-label block mb-1.5">Completion Criteria</span>
              <ul className="space-y-1">
                {task.criteria.map((c, ci) => (
                  <li key={ci} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(task.scope?.length ?? 0) > 0 && (
            <div>
              <span className="section-label block mb-1.5">Scope</span>
              <div className="flex flex-wrap gap-1">
                {(task.scope ?? []).map((s, si) => (
                  <span key={si} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
