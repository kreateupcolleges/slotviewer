import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const body = await request.json();
    const overlaps = await query(
      `
      SELECT id FROM schedule_trainings
      WHERE status <> 'completed'
        AND $1::date BETWEEN start_date AND end_date
      LIMIT 1
    `,
      [body.date]
    );

    if (overlaps.rowCount) {
      return NextResponse.json(
        { error: "A training is already scheduled on this date." },
        { status: 409 }
      );
    }

    await query(
      `
      INSERT INTO unavailable_dates (unavailable_date, reason)
      VALUES ($1, $2)
      ON CONFLICT (unavailable_date) DO UPDATE SET reason = EXCLUDED.reason
    `,
      [body.date, body.reason]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to block date" },
      { status: 500 }
    );
  }
}
