import type { WaterfallGroup } from "@/types/waterfall";

type SprintHeaderProps = {
  sprint: WaterfallGroup["sprint"];
  progress: WaterfallGroup["progress"];
};

export function SprintHeader({ sprint, progress }: SprintHeaderProps) {
  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
      <h3 className="text-xs font-medium">{sprint.title}</h3>
      <span className="text-[10px] text-muted-foreground">
        {progress.done}/{progress.total} ({percent}%)
      </span>
    </div>
  );
}
