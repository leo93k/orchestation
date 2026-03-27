import { NextResponse } from "next/server";
import { runClaudeSync } from "@/lib/claude-cli";
import { getErrorMessage } from "@/lib/error-utils";
import { readTemplate } from "@/lib/template";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const prompt = readTemplate("prompt/task-suggest.md");

    // stdin pipe 방식으로 실행하여 셸 인젝션 위험 제거
    const text = runClaudeSync(prompt, {
      timeout: 120_000,
      extraArgs: ["--dangerously-skip-permissions"],
    });

    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({
        suggestions: [],
        error: "추천 결과를 파싱할 수 없습니다.",
      });
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err) {
    const msg = getErrorMessage(err, String(err));
    return NextResponse.json({ suggestions: [], error: msg }, { status: 500 });
  }
}
