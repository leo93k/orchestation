import { NextResponse } from "next/server";
import { readRunHistory } from "@/lib/run-history";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readRunHistory();
  return NextResponse.json(data);
}
