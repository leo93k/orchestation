import { spawn, execSync, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { pipeProcessLogs, killProcessGracefully } from "./process-utils";
import { getErrorMessage } from "./error-utils";
import { PROJECT_ROOT } from "./paths";

export type TaskRunStatus = "idle" | "running" | "completed" | "failed";
export type TaskRunPhase = "task" | "review" | "merge" | "done";

export interface TaskRunState {
  taskId: string;
  status: TaskRunStatus;
  phase: TaskRunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  exitCode: number | null;
}

class TaskRunnerManager {
  /** Currently running tasks keyed by task ID */
  private runs: Map<string, { state: TaskRunState; process: ChildProcess }> =
    new Map();

  /** iTerm 모드 watcher (stop 시 정리용) */
  private watchers: Map<string, fs.FSWatcher[]> = new Map();

  /** Event emitter for log streaming: emits "log:<taskId>" with line string, "done:<taskId>" on finish */
  public events = new EventEmitter();

  private getProjectRoot(): string {
    return PROJECT_ROOT;
  }

  /** config.json에서 workerMode 읽기 */
  private getWorkerMode(): string {
    try {
      const configPath = path.join(this.getProjectRoot(), ".orchestration", "config.json");
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);
      return config.workerMode || "background";
    } catch {
      return "background";
    }
  }

  /** iTerm2 새 탭에서 명령어 실행 */
  private runInIterm(tabTitle: string, cmd: string): boolean {
    try {
      const script = `
tell application "iTerm"
  activate
  tell current window
    set newTab to (create tab with default profile)
    tell current session of newTab
      set name to "${tabTitle}"
      write text "${cmd}"
    end tell
  end tell
end tell`;
      execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  getState(taskId: string): TaskRunState | null {
    const run = this.runs.get(taskId);
    return run
      ? { ...run.state, logs: [...run.state.logs] }
      : null;
  }

  isRunning(taskId: string): boolean {
    return this.runs.get(taskId)?.state.status === "running";
  }

  /** Returns all task IDs that are currently running */
  getRunningIds(): string[] {
    const ids: string[] = [];
    for (const [id, run] of this.runs) {
      if (run.state.status === "running") ids.push(id);
    }
    return ids;
  }

  run(taskId: string): { success: boolean; error?: string } {
    if (this.isRunning(taskId)) {
      return { success: false, error: `Task ${taskId} is already running` };
    }

    const projectRoot = this.getProjectRoot();
    const signalDir = path.join(projectRoot, ".orchestration", "signals");
    const workerMode = this.getWorkerMode();

    const state: TaskRunState = {
      taskId,
      status: "running",
      phase: "task",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logs: [],
      exitCode: null,
    };

    state.logs.push(`[task-runner] Starting ${taskId} at ${state.startedAt} (mode: ${workerMode})`);

    // status → in_progress
    this.updateTaskFileStatus(taskId, "in_progress");

    if (workerMode === "iterm") {
      return this.runIterm(taskId, state, signalDir);
    }
    return this.runBackground(taskId, state, signalDir);
  }

  /** 백그라운드 모드: spawn + exit code 기반 체이닝 */
  private runBackground(taskId: string, state: TaskRunState, signalDir: string): { success: boolean; error?: string } {
    const projectRoot = this.getProjectRoot();
    const scriptPath = path.join(projectRoot, "scripts", "job-task.sh");

    let proc: ChildProcess;
    try {
      proc = spawn("bash", [scriptPath, taskId, signalDir], {
        cwd: projectRoot,
        env: { ...process.env, SKIP_SIGNAL: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      state.logs.push(`[task-runner] Failed to spawn: ${msg}`);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      state.exitCode = 1;
      this.updateTaskFileStatus(taskId, "failed");
      return { success: false, error: msg };
    }

    this.runs.set(taskId, { state, process: proc });

    pipeProcessLogs(proc, (line) => {
      state.logs.push(line);
      this.events.emit(`log:${taskId}`, line);
    });

    proc.on("close", (code: number | null) => {
      state.exitCode = code ?? 1;
      const exitLine = `[task-runner] ${taskId} task exited with code ${code}`;
      state.logs.push(exitLine);
      this.events.emit(`log:${taskId}`, exitLine);

      if (code === 0) {
        // task 성공 → review 시작
        this.startReview(taskId, state);
      } else {
        // task 실패 → 종료
        state.status = "failed";
        state.finishedAt = new Date().toISOString();
        this.updateTaskFileStatus(taskId, "failed");
        this.cleanupSignals(taskId);
        this.events.emit(`done:${taskId}`, "failed");
      }
    });

    proc.on("error", (err: Error) => {
      const errLine = `[task-runner] Process error: ${err.message}`;
      state.logs.push(errLine);
      this.events.emit(`log:${taskId}`, errLine);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      this.updateTaskFileStatus(taskId, "failed");
      this.events.emit(`done:${taskId}`, "failed");
    });

    return { success: true };
  }

  /** iTerm 모드: iTerm 탭에서 실행 + signal 파일 폴링으로 완료 감지 */
  private runIterm(taskId: string, state: TaskRunState, signalDir: string): { success: boolean; error?: string } {
    const projectRoot = this.getProjectRoot();
    const scriptPath = path.join(projectRoot, "scripts", "job-task.sh");
    const logFile = path.join(projectRoot, "output", "logs", `${taskId}.log`);
    const closeScript = path.join(projectRoot, "scripts", "lib", "close-iterm-session.sh");

    // output/logs 디렉토리 보장
    fs.mkdirSync(path.dirname(logFile), { recursive: true });

    const cmd = `SKIP_SIGNAL=1 bash '${scriptPath}' '${taskId}' '${signalDir}' 2>&1 | tee '${logFile}'; bash '${closeScript}'`;

    const opened = this.runInIterm(`🔧 ${taskId}`, cmd);
    if (!opened) {
      state.logs.push("[task-runner] iTerm2가 실행 중이지 않습니다. 백그라운드로 전환합니다.");
      this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
      return this.runBackground(taskId, state, signalDir);
    }

    state.logs.push(`[task-runner] ${taskId}: iTerm 탭에서 실행 중`);
    this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);

    // 더미 프로세스 (stop 시 사용하지 않지만 runs Map 유지용)
    const dummy = spawn("sleep", ["999999"], { stdio: "ignore", detached: true });
    dummy.unref();
    this.runs.set(taskId, { state, process: dummy });

    // fs.watch로 로그 파일 + signal 파일 감지
    this.watchItermCompletion(taskId, state, logFile, signalDir, dummy);

    return { success: true };
  }

  /** 해당 태스크의 watcher를 모두 정리 */
  private closeWatchers(taskId: string): void {
    const list = this.watchers.get(taskId);
    if (list) {
      for (const w of list) { try { w.close(); } catch { /* ignore */ } }
      this.watchers.delete(taskId);
    }
  }

  /** watcher를 등록 (taskId별 관리) */
  private addWatcher(taskId: string, watcher: fs.FSWatcher): void {
    const list = this.watchers.get(taskId) ?? [];
    list.push(watcher);
    this.watchers.set(taskId, list);
  }

  /** 로그 파일 tail을 fs.watch로 구현 */
  private watchLogFile(taskId: string, state: TaskRunState, logFile: string): void {
    let lastSize = 0;

    const readNew = () => {
      try {
        if (!fs.existsSync(logFile)) return;
        const stat = fs.statSync(logFile);
        if (stat.size <= lastSize) return;
        const fd = fs.openSync(logFile, "r");
        const buf = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        lastSize = stat.size;
        for (const line of buf.toString("utf-8").split("\n")) {
          if (line.trim()) {
            state.logs.push(line);
            this.events.emit(`log:${taskId}`, line);
          }
        }
      } catch { /* ignore */ }
    };

    // 초기 읽기
    readNew();

    try {
      // 로그 디렉토리 확보
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      // 파일이 없으면 빈 파일 생성 (watch 대상 필요)
      if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "");

      const watcher = fs.watch(logFile, () => readNew());
      this.addWatcher(taskId, watcher);
    } catch { /* ignore */ }
  }

  /** iTerm 모드: signal 디렉토리를 fs.watch로 감시하여 완료 감지 */
  private watchItermCompletion(
    taskId: string,
    state: TaskRunState,
    logFile: string,
    signalDir: string,
    dummy: ChildProcess,
  ): void {
    // 기존 watcher 정리
    this.closeWatchers(taskId);

    // 로그 파일 감시
    this.watchLogFile(taskId, state, logFile);

    // signal 디렉토리 감시
    try {
      fs.mkdirSync(signalDir, { recursive: true });

      const watcher = fs.watch(signalDir, (_event, filename) => {
        if (!filename || !filename.startsWith(taskId)) return;
        if (state.status !== "running") return;

        const doneSignal = path.join(signalDir, `${taskId}-task-done`);
        const failedSignal = path.join(signalDir, `${taskId}-task-failed`);

        if (filename === `${taskId}-task-done` && fs.existsSync(doneSignal)) {
          this.closeWatchers(taskId);
          try { fs.unlinkSync(doneSignal); } catch { /* ignore */ }
          try { dummy.kill(); } catch { /* ignore */ }

          const doneLine = `[task-runner] ${taskId} task 완료 (iTerm) → review 시작`;
          state.logs.push(doneLine);
          this.events.emit(`log:${taskId}`, doneLine);

          this.startReviewIterm(taskId, state, signalDir);

        } else if (filename === `${taskId}-task-failed` && fs.existsSync(failedSignal)) {
          this.closeWatchers(taskId);
          try { fs.unlinkSync(failedSignal); } catch { /* ignore */ }
          try { dummy.kill(); } catch { /* ignore */ }

          state.status = "failed";
          state.finishedAt = new Date().toISOString();
          this.updateTaskFileStatus(taskId, "failed");
          this.cleanupSignals(taskId);
          const failLine = `[task-runner] ${taskId} task 실패 (iTerm)`;
          state.logs.push(failLine);
          this.events.emit(`log:${taskId}`, failLine);
          this.events.emit(`done:${taskId}`, "failed");
        }
      });
      this.addWatcher(taskId, watcher);
    } catch { /* ignore */ }
  }

  /** iTerm 모드: review를 iTerm 탭에서 실행 */
  private startReviewIterm(taskId: string, state: TaskRunState, signalDir: string): void {
    const projectRoot = this.getProjectRoot();
    const reviewScript = path.join(projectRoot, "scripts", "job-review.sh");
    const logFile = path.join(projectRoot, "output", "logs", `${taskId}-review.log`);
    const closeScript = path.join(projectRoot, "scripts", "lib", "close-iterm-session.sh");

    state.phase = "review";
    const cmd = `bash '${reviewScript}' '${taskId}' '${signalDir}' 2>&1 | tee '${logFile}'; bash '${closeScript}'`;

    const opened = this.runInIterm(`🔍 ${taskId} review`, cmd);
    if (!opened) {
      this.startReview(taskId, state);
      return;
    }

    state.logs.push(`[task-runner] ${taskId}: iTerm 탭에서 review 실행 중`);
    this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);

    // 로그 파일 감시
    this.watchLogFile(taskId, state, logFile);

    // signal 디렉토리 감시로 review 완료 감지
    try {
      const watcher = fs.watch(signalDir, (_event, filename) => {
        if (!filename || !filename.startsWith(taskId)) return;
        if (state.status !== "running") return;

        const approvedSignal = path.join(signalDir, `${taskId}-review-approved`);
        const rejectedSignal = path.join(signalDir, `${taskId}-review-rejected`);

        if (filename === `${taskId}-review-approved` && fs.existsSync(approvedSignal)) {
          this.closeWatchers(taskId);
          try { fs.unlinkSync(approvedSignal); } catch { /* ignore */ }

          state.logs.push(`[task-runner] ${taskId} review 승인 (iTerm) → merge 시작`);
          this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
          this.startMerge(taskId, state);

        } else if (filename === `${taskId}-review-rejected` && fs.existsSync(rejectedSignal)) {
          this.closeWatchers(taskId);
          try { fs.unlinkSync(rejectedSignal); } catch { /* ignore */ }

          state.status = "failed";
          state.finishedAt = new Date().toISOString();
          this.updateTaskFileStatus(taskId, "failed");
          this.cleanupSignals(taskId);
          state.logs.push(`[task-runner] ${taskId} review 수정요청 (iTerm) → 실패 처리`);
          this.events.emit(`log:${taskId}`, state.logs[state.logs.length - 1]);
          this.events.emit(`done:${taskId}`, "failed");
        }
      });
      this.addWatcher(taskId, watcher);
    } catch { /* ignore */ }
  }

  private startReview(taskId: string, state: TaskRunState): void {
    const projectRoot = this.getProjectRoot();
    const reviewScript = path.join(projectRoot, "scripts", "job-review.sh");
    const signalDir = path.join(projectRoot, ".orchestration", "signals");

    state.phase = "review";
    const reviewLine = `[task-runner] ${taskId} task 완료 → review 시작`;
    state.logs.push(reviewLine);
    this.events.emit(`log:${taskId}`, reviewLine);

    let proc: ChildProcess;
    try {
      proc = spawn("bash", [reviewScript, taskId, signalDir], {
        cwd: projectRoot,
        env: { ...process.env, SKIP_SIGNAL: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      state.logs.push(`[task-runner] Failed to spawn review: ${msg}`);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      this.updateTaskFileStatus(taskId, "failed");
      this.events.emit(`done:${taskId}`, "failed");
      return;
    }

    // 프로세스 참조 업데이트 (stop 시 사용)
    const run = this.runs.get(taskId);
    if (run) run.process = proc;

    pipeProcessLogs(proc, (line) => {
      state.logs.push(line);
      this.events.emit(`log:${taskId}`, line);
    });

    proc.on("close", (code: number | null) => {
      const exitLine = `[task-runner] ${taskId} review exited with code ${code}`;
      state.logs.push(exitLine);
      this.events.emit(`log:${taskId}`, exitLine);

      if (code === 0) {
        // review 승인 → merge
        this.startMerge(taskId, state);
      } else {
        // review 수정요청 → 실패 처리
        state.status = "failed";
        state.exitCode = code ?? 1;
        state.finishedAt = new Date().toISOString();
        this.updateTaskFileStatus(taskId, "failed");
        this.cleanupSignals(taskId);
        const failLine = `[task-runner] ${taskId} review 수정요청 → 실패 처리`;
        state.logs.push(failLine);
        this.events.emit(`log:${taskId}`, failLine);
        this.events.emit(`done:${taskId}`, "failed");
      }
    });

    proc.on("error", (err: Error) => {
      const errLine = `[task-runner] Review process error: ${err.message}`;
      state.logs.push(errLine);
      this.events.emit(`log:${taskId}`, errLine);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      this.updateTaskFileStatus(taskId, "failed");
      this.events.emit(`done:${taskId}`, "failed");
    });
  }

  private startMerge(taskId: string, state: TaskRunState): void {
    const projectRoot = this.getProjectRoot();
    const mergeScript = path.join(projectRoot, "scripts", "lib", "merge-task.sh");

    state.phase = "merge";
    const mergeLine = `[task-runner] ${taskId} review 승인 → merge 시작`;
    state.logs.push(mergeLine);
    this.events.emit(`log:${taskId}`, mergeLine);

    let proc: ChildProcess;
    try {
      proc = spawn("bash", [mergeScript, taskId], {
        cwd: projectRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });
    } catch (err) {
      const msg = getErrorMessage(err, String(err));
      state.logs.push(`[task-runner] Failed to spawn merge: ${msg}`);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      this.updateTaskFileStatus(taskId, "failed");
      this.events.emit(`done:${taskId}`, "failed");
      return;
    }

    const run = this.runs.get(taskId);
    if (run) run.process = proc;

    pipeProcessLogs(proc, (line) => {
      state.logs.push(line);
      this.events.emit(`log:${taskId}`, line);
    });

    proc.on("close", (code: number | null) => {
      state.exitCode = code ?? 1;
      state.finishedAt = new Date().toISOString();
      this.cleanupSignals(taskId);

      if (code === 0) {
        state.status = "completed";
        state.phase = "done";
        const doneLine = `[task-runner] ${taskId} merge 완료 → done`;
        state.logs.push(doneLine);
        this.events.emit(`log:${taskId}`, doneLine);
        this.events.emit(`done:${taskId}`, "completed");
      } else {
        state.status = "failed";
        this.updateTaskFileStatus(taskId, "failed");
        const failLine = `[task-runner] ${taskId} merge 실패 (exit=${code})`;
        state.logs.push(failLine);
        this.events.emit(`log:${taskId}`, failLine);
        this.events.emit(`done:${taskId}`, "failed");
      }
    });

    proc.on("error", (err: Error) => {
      const errLine = `[task-runner] Merge process error: ${err.message}`;
      state.logs.push(errLine);
      this.events.emit(`log:${taskId}`, errLine);
      state.status = "failed";
      state.finishedAt = new Date().toISOString();
      this.updateTaskFileStatus(taskId, "failed");
      this.events.emit(`done:${taskId}`, "failed");
    });
  }

  /** 태스크 파일의 status를 직접 갱신 */
  private updateTaskFileStatus(taskId: string, status: string): void {
    try {
      const projectRoot = this.getProjectRoot();
      const tasksDir = path.join(projectRoot, ".orchestration", "tasks");
      const files = fs.readdirSync(tasksDir);
      const taskFile = files.find((f) => f.startsWith(`${taskId}-`) && f.endsWith(".md"));
      if (!taskFile) {
        console.error(`[task-runner] updateTaskFileStatus: file not found for ${taskId} in ${tasksDir}`);
        return;
      }

      const filePath = path.join(tasksDir, taskFile);
      const raw = fs.readFileSync(filePath, "utf-8");
      const updated = raw.replace(/^status:\s*.+$/m, `status: ${status}`);
      fs.writeFileSync(filePath, updated, "utf-8");
      console.log(`[task-runner] ${taskId} status → ${status} (file: ${taskFile})`);
    } catch (err) {
      console.error(`[task-runner] updateTaskFileStatus failed:`, err);
    }
  }

  /** 해당 태스크의 signal 파일 잔여물 정리 */
  private cleanupSignals(taskId: string): void {
    try {
      const projectRoot = this.getProjectRoot();
      const signalDir = path.join(projectRoot, ".orchestration", "signals");
      if (!fs.existsSync(signalDir)) return;

      const suffixes = [
        "task-done", "task-failed", "task-rejected",
        "review-approved", "review-rejected",
        "stop-request", "stopped", "start",
      ];
      for (const suffix of suffixes) {
        const f = path.join(signalDir, `${taskId}-${suffix}`);
        try { fs.unlinkSync(f); } catch { /* ignore */ }
      }
    } catch {
      // best-effort
    }
  }

  stop(taskId: string): { success: boolean; error?: string } {
    const run = this.runs.get(taskId);
    if (!run || run.state.status !== "running") {
      return { success: false, error: `Task ${taskId} is not running` };
    }

    run.state.logs.push(`[task-runner] Stop requested for ${taskId}`);

    // watcher 정리 (iTerm 모드)
    this.closeWatchers(taskId);

    // iTerm 모드: 실제 프로세스를 pgrep으로 찾아서 kill
    if (this.getWorkerMode() === "iterm") {
      this.killItermTask(taskId);
    }

    killProcessGracefully(run.process);

    // 상태 즉시 반영
    run.state.status = "failed";
    run.state.finishedAt = new Date().toISOString();
    this.updateTaskFileStatus(taskId, "stopped");
    this.cleanupSignals(taskId);
    this.events.emit(`done:${taskId}`, "failed");

    return { success: true };
  }

  /** iTerm에서 실행 중인 task 프로세스를 찾아서 kill */
  private killItermTask(taskId: string): void {
    try {
      // job-task.sh 또는 job-review.sh 프로세스 찾기
      const pids = execSync(
        `pgrep -f "job-(task|review)\\.sh ${taskId}" 2>/dev/null || true`,
        { encoding: "utf-8" },
      ).trim();

      if (pids) {
        for (const pid of pids.split("\n")) {
          const p = pid.trim();
          if (p) {
            try {
              process.kill(-parseInt(p, 10), "SIGTERM");
            } catch {
              try { process.kill(parseInt(p, 10), "SIGTERM"); } catch { /* already dead */ }
            }
          }
        }
      }
    } catch { /* ignore */ }
  }
}

// Use globalThis to ensure single instance across server.ts and Next.js API routes
const globalKey = "__taskRunnerManager__";
const taskRunnerManager: TaskRunnerManager =
  (globalThis as Record<string, unknown>)[globalKey] as TaskRunnerManager ??
  ((globalThis as Record<string, unknown>)[globalKey] = new TaskRunnerManager());
export default taskRunnerManager;
