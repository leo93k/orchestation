"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  memo,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

/* ── Context ── */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ── Toast Viewport (portalled, isolated from main tree) ── */
const ToastViewport = memo(function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="toast-viewport"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
});

/* ── Provider ── */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      if (!message || typeof message !== "string") return;
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      // Auto dismiss after 4 seconds
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast],
  );

  // Memoize context value to avoid unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

/* ── Toast Item ── */
const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; icon: typeof CheckCircle2; iconClass: string }
> = {
  success: {
    bg: "bg-emerald-500/10 border-emerald-500/30",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  error: {
    bg: "bg-red-500/10 border-red-500/30",
    icon: AlertCircle,
    iconClass: "text-red-500",
  },
  info: {
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: Info,
    iconClass: "text-blue-500",
  },
};

const ToastItem = memo(function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const style = VARIANT_STYLES[toast.variant];
  const Icon = style.icon;

  const handleDismiss = useCallback(() => {
    setExiting(true);
  }, []);

  const handleAnimationEnd = useCallback(() => {
    if (exiting) {
      onDismiss(toast.id);
    }
  }, [exiting, onDismiss, toast.id]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm",
        exiting ? "toast-slide-out" : "toast-slide-in",
        "min-w-[280px] max-w-[420px]",
        style.bg,
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      <Icon className={cn("h-4 w-4 shrink-0", style.iconClass)} />
      <span className="text-sm text-foreground flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
