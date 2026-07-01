import { NextResponse } from "next/server";
import { ensureSchema, seedIfEmpty } from "@/lib/db";

export async function POST() {
  try {
    await ensureSchema();
    await seedIfEmpty();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bootstrap failed" },
      { status: 500 }
    );
  }
}
