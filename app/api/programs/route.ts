import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const body = await request.json();
    const facultyIds = Array.isArray(body.facultyIds) ? body.facultyIds : [];
    const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
    const checklistMode = body.checklistMode ?? "none";

    await query("BEGIN");
    const program = await query<{ id: number }>(
      `
      INSERT INTO training_programs (title, category, start_date, end_date, room, capacity, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'planning')
      RETURNING id
    `,
      [
        body.title,
        body.category,
        body.startDate,
        body.endDate,
        body.room,
        Number(body.capacity || 24)
      ]
    );

    const programId = program.rows[0].id;

    for (const facultyId of facultyIds) {
      await query(
        "INSERT INTO program_faculty (program_id, faculty_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [programId, Number(facultyId)]
      );
    }

    for (const studentId of studentIds) {
      await query(
        "INSERT INTO program_students (program_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [programId, Number(studentId)]
      );
    }

    if (checklistMode === "template" && body.templateId) {
      const checklist = await query<{ id: number }>(
        `
        INSERT INTO program_checklists (program_id, template_id, name)
        SELECT $1, id, name FROM checklist_templates WHERE id = $2
        RETURNING id
      `,
        [programId, Number(body.templateId)]
      );
      await query(
        `
        INSERT INTO program_checklist_items (program_checklist_id, label, sort_order)
        SELECT $1, label, sort_order FROM checklist_items WHERE template_id = $2
      `,
        [checklist.rows[0].id, Number(body.templateId)]
      );
    }

    if (checklistMode === "new" && body.checklistName) {
      const template = await query<{ id: number }>(
        "INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id",
        [body.checklistName, "Created during program planning"]
      );
      const labels = String(body.checklistItems ?? "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

      for (const [index, label] of labels.entries()) {
        await query(
          "INSERT INTO checklist_items (template_id, label, sort_order) VALUES ($1, $2, $3)",
          [template.rows[0].id, label, index + 1]
        );
      }

      const checklist = await query<{ id: number }>(
        "INSERT INTO program_checklists (program_id, template_id, name) VALUES ($1, $2, $3) RETURNING id",
        [programId, template.rows[0].id, body.checklistName]
      );

      for (const [index, label] of labels.entries()) {
        await query(
          "INSERT INTO program_checklist_items (program_checklist_id, label, sort_order) VALUES ($1, $2, $3)",
          [checklist.rows[0].id, label, index + 1]
        );
      }
    }

    if (body.slotDate && body.startTime && body.endTime) {
      await query(
        `
        INSERT INTO slots (program_id, faculty_id, slot_date, start_time, end_time, room, capacity, booked_count, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'available')
      `,
        [
          programId,
          facultyIds[0] ? Number(facultyIds[0]) : null,
          body.slotDate,
          body.startTime,
          body.endTime,
          body.room,
          Number(body.capacity || 24)
        ]
      );
    }

    await query("COMMIT");
    return NextResponse.json({ id: programId });
  } catch (error) {
    await query("ROLLBACK").catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create program" },
      { status: 500 }
    );
  }
}
