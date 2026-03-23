"use client";

import { useState } from "react";
import type { WaterfallGroup, WaterfallTask } from "@/types/waterfall";
import { SprintProgress } from "./SprintProgress";
import { TaskBar } from "./TaskBar";
import { TaskDetailPanel } from "./TaskDetailPanel";

type WaterfallContainerProps = {
  groups: WaterfallGroup[];
};

export function WaterfallContainer({ groups }: WaterfallContainerProps) {
  const [selectedTask, setSelectedTask] = useState<WaterfallTask | null>(null);

  return (
    <>
      <div className="flex flex-col">
        {groups.map((group) => (
          <SprintProgress
            key={group.sprint.id}
            title={group.sprint.title}
            done={group.progress.done}
            total={group.progress.total}
          >
            <div className="flex flex-col py-0.5">
              {group.tasks.length > 0 ? (
                group.tasks.map((task) => (
                  <TaskBar
                    key={task.id}
                    task={task}
                    onClick={setSelectedTask}
                  />
                ))
              ) : (
                <p className="py-1 px-2 text-xs text-muted-foreground">
                  No tasks
                </p>
              )}
            </div>
          </SprintProgress>
        ))}
      </div>

      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </>
  );
}
