import { spawnClaude, CLAUDE_DEFAULT_TIMEOUT_MS, ClaudeChildProcess } from "@/lib/claude-cli";
import { renderTemplate } from "@/lib/template";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AnalyzedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  criteria: string[];
  scope: string[];
  depends_on: number[];
}

export async function POST(request: Request) {
  let title: string;
  let description: string;

  try {
    const body = await request.json();
    title = body.title;
    description = body.description || "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!title || typeof title !== "string" || !title.trim()) {
    return new Response(JSON.stringify({ error: "title is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = renderTemplate("prompt/task-analyze.md", {
    title: title.trim(),
    description_line: description.trim() ? `Description: ${description.trim()}` : "",
  });

  return new Promise<Response>((resolve) => {
    const child: ClaudeChildProcess = spawnClaude(prompt);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // 90초 타임아웃: SIGTERM은 spawnClaude 내부에서 처리됨.
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      resolve(
        new Response(
          JSON.stringify({ error: "Analysis timed out. Please try again." }),
          { status: 504, headers: { "Content-Type": "application/json" } },
        ),
      );
    }, CLAUDE_DEFAULT_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);
      if (timedOut) return;

      if (code !== 0) {
        console.error("Claude CLI stderr:", stderr);
        resolve(
          new Response(
            JSON.stringify({ error: "AI analysis failed. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
        );
        return;
      }

      try {
        // Extract JSON from response (may have surrounding text)
        const jsonMatch = stdout.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
        if (!jsonMatch) {
          // Fallback: create a single task from the original request
          const fallback: { tasks: AnalyzedTask[] } = {
            tasks: [
              {
                title: title.trim(),
                description: description.trim() || title.trim(),
                priority: "medium",
                criteria: ["Complete the requested work"],
                scope: [],
                depends_on: [],
              },
            ],
          };
          resolve(
            new Response(JSON.stringify(fallback), {
              headers: { "Content-Type": "application/json" },
            }),
          );
          return;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
          throw new Error("Invalid response structure");
        }

        // Validate and sanitize
        const tasks: AnalyzedTask[] = parsed.tasks.map(
          (t: Record<string, unknown>) => ({
            title: typeof t.title === "string" ? t.title : title.trim(),
            description:
              typeof t.description === "string" ? t.description : "",
            priority: ["high", "medium", "low"].includes(t.priority as string)
              ? (t.priority as "high" | "medium" | "low")
              : "medium",
            criteria: Array.isArray(t.criteria)
              ? t.criteria.filter((c: unknown) => typeof c === "string")
              : [],
            scope: Array.isArray(t.scope)
              ? t.scope.filter((s: unknown) => typeof s === "string")
              : [],
            depends_on: Array.isArray(t.depends_on)
              ? t.depends_on.filter((d: unknown) => typeof d === "number")
              : [],
          }),
        );

        resolve(
          new Response(JSON.stringify({ tasks }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      } catch (err) {
        console.error("Failed to parse AI response:", stdout);
        // Fallback
        resolve(
          new Response(
            JSON.stringify({
              tasks: [
                {
                  title: title.trim(),
                  description: description.trim() || title.trim(),
                  priority: "medium",
                  criteria: ["Complete the requested work"],
                  scope: [],
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTimer);
      console.error("Claude CLI spawn error:", err.message);
      resolve(
        new Response(
          JSON.stringify({ error: "Failed to call AI. Please try again." }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
  });
}
