import { NextRequest, NextResponse } from "next/server";
import { createTraining, ensureSchema, query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const body = await request.json();
    const conflicts = await query(
      `
      SELECT id FROM unavailable_dates
      WHERE unavailable_date BETWEEN $1::date AND $2::date
      LIMIT 1
    `,
      [body.startDate, body.endDate]
    );

    if (conflicts.rowCount) {
      return NextResponse.json(
        { error: "Selected range includes an unavailable date." },
        { status: 409 }
      );
    }

    const overlaps = await query(
      `
      SELECT id FROM schedule_trainings
      WHERE status <> 'completed'
        AND daterange(start_date, end_date, '[]') && daterange($1::date, $2::date, '[]')
      LIMIT 1
    `,
      [body.startDate, body.endDate]
    );

    if (overlaps.rowCount) {
      return NextResponse.json(
        { error: "A training already occupies one or more selected dates." },
        { status: 409 }
      );
    }

    const id = await createTraining(body);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create training" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSchema();
    const body = await request.json();
    const id = Number(body.id);

    if (body.action === "complete") {
      await query(
        "UPDATE schedule_trainings SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [id]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.action === "edit") {
      await query(
        `
        UPDATE schedule_trainings
        SET college_name = $1,
            audience = $2,
            program_name = $3,
            faculty_name = $4,
            coordinator_name = $5,
            coordinator_phone = $6,
            venue = $7,
            faculty_count = $8,
            participant_count = $9,
            priority = $10,
            start_session_label = $11,
            start_session_start = $12,
            start_session_end = $13,
            end_session_label = $14,
            end_session_start = $15,
            end_session_end = $16,
            notes = $17,
            updated_at = NOW()
        WHERE id = $18
      `,
        [
          body.collegeName,
          body.audience,
          body.programName,
          body.facultyName,
          body.coordinatorName ?? "",
          body.coordinatorPhone ?? "",
          body.venue ?? "",
          Number(body.facultyCount ?? 1),
          Number(body.participantCount ?? 0),
          body.priority ?? "normal",
          body.startSessionLabel ?? "morning",
          body.startSessionStart ?? "09:30",
          body.startSessionEnd ?? "12:30",
          body.endSessionLabel ?? "afternoon",
          body.endSessionStart ?? "13:30",
          body.endSessionEnd ?? "16:30",
          body.notes ?? "",
          id
        ]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.action === "toggleTodo") {
      await query(
        `
        UPDATE schedule_todos
        SET done = NOT done
        WHERE id = $1
      `,
        [Number(body.todoId)]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reschedule") {
      const conflicts = await query(
        `
        SELECT id FROM unavailable_dates
        WHERE unavailable_date BETWEEN $1::date AND $2::date
        LIMIT 1
      `,
        [body.startDate, body.endDate]
      );

      if (conflicts.rowCount) {
        return NextResponse.json(
          { error: "New range includes an unavailable date." },
          { status: 409 }
        );
      }

      const overlaps = await query(
        `
        SELECT id FROM schedule_trainings
        WHERE id <> $3
          AND status <> 'completed'
          AND daterange(start_date, end_date, '[]') && daterange($1::date, $2::date, '[]')
        LIMIT 1
      `,
        [body.startDate, body.endDate, id]
      );

      if (overlaps.rowCount) {
        return NextResponse.json(
          { error: "Another training already uses the new date range." },
          { status: 409 }
        );
      }

      await query(
        `
        UPDATE schedule_trainings
        SET start_date = $1, end_date = $2, status = 'postponed', updated_at = NOW()
        WHERE id = $3
      `,
        [body.startDate, body.endDate, id]
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update training" },
      { status: 500 }
    );
  }
}
