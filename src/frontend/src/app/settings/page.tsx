"use client";

import { Save, Loader2, Plus, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { WorkerMode } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface AppSettings {
  apiKey: string;
  srcPaths: string[];
  model: string;
  maxParallel: number;
  maxReviewRetry: number;
  workerMode: WorkerMode;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AppSettings>({
    apiKey: "",
    srcPaths: ["src/"],
    model: "claude-sonnet-4-6",
    maxParallel: 3,
    maxReviewRetry: 2,
    workerMode: "background",
  });
  const { addToast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setDraft(data);
      }
    } catch {
      addToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setDraft(updated);
        addToast("Settings saved", "success");
      } else {
        addToast("Failed to save settings", "error");
      }
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = settings !== null && JSON.stringify(draft) !== JSON.stringify(settings);

  const maskedKey = draft.apiKey
    ? `${draft.apiKey.slice(0, 7)}${"*".repeat(Math.max(0, draft.apiKey.length - 11))}${draft.apiKey.slice(-4)}`
    : "";

  return (
    <div className="max-w-[560px] mx-auto py-8 px-6">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Name / Title */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Name</label>
            <div className="settings-field-ro">
              Orchestration
            </div>
            <p className="text-xs text-muted-foreground/60 font-mono">
              sdadaniel/orchestation
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label htmlFor="apiKey" className="text-sm text-muted-foreground">API Key</label>
            <input
              id="apiKey"
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-ant-api03-..."
              className="settings-input font-mono"
            />
            <p className="text-xs text-muted-foreground/60">
              Anthropic API key for orchestrate.sh and Night Worker
            </p>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Model</label>
            <div className="relative">
              <select
                value={draft.model}
                onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                className="settings-input appearance-none cursor-pointer pr-8"
              >
                <option value="claude-haiku-4-5-20251001">claude-haiku-4.5</option>
                <option value="claude-sonnet-4-6">claude-sonnet-4.6</option>
                <option value="claude-opus-4-6">claude-opus-4.6</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* TOOLS section */}
          <div className="space-y-5">
            <h2 className="settings-section-label">Source Paths</h2>

            {/* Source Paths */}
            <div className="space-y-2">
              {draft.srcPaths.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p}
                    onChange={(e) => {
                      const next = [...draft.srcPaths];
                      next[i] = e.target.value;
                      setDraft((prev) => ({ ...prev, srcPaths: next }));
                    }}
                    className="settings-input font-mono flex-1"
                    placeholder="src/"
                  />
                  {draft.srcPaths.length > 1 && (
                    <button
                      onClick={() => setDraft((prev) => ({ ...prev, srcPaths: prev.srcPaths.filter((_, j) => j !== i) }))}
                      className="settings-ghost-btn text-muted-foreground hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setDraft((prev) => ({ ...prev, srcPaths: [...prev.srcPaths, ""] }))}
                className="settings-ghost-btn text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Path</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* MODEL CONFIGURATION section */}
          <div className="space-y-6">
            <h2 className="settings-section-label">Configuration</h2>

            {/* Worker Mode */}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Worker mode</label>
              <div className="relative">
                <select
                  value={draft.workerMode}
                  onChange={(e) => setDraft((prev) => ({ ...prev, workerMode: e.target.value as WorkerMode }))}
                  className="settings-input appearance-none cursor-pointer pr-8"
                >
                  <option value="background">background</option>
                  <option value="iterm">iterm</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>

            {/* Max Parallel Tasks - Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Max parallel tasks</label>
                <span className="text-sm text-foreground tabular-nums">{draft.maxParallel}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={draft.maxParallel}
                onChange={(e) => setDraft((prev) => ({ ...prev, maxParallel: parseInt(e.target.value, 10) }))}
                className="settings-slider"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/50">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Max Review Retry - Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Max review retry</label>
                <span className="text-sm text-foreground tabular-nums">{draft.maxReviewRetry}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                value={draft.maxReviewRetry}
                onChange={(e) => setDraft((prev) => ({ ...prev, maxReviewRetry: parseInt(e.target.value, 10) }))}
                className="settings-slider"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/50">
                <span>0</span>
                <span>5</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                isDirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
