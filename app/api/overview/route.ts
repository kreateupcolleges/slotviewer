import { NextResponse } from "next/server";
import { ensureSchema, getScheduleOverview } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    return NextResponse.json(await getScheduleOverview());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load overview" },
      { status: 500 }
    );
  }
}
