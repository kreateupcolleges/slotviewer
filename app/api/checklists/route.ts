import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const body = await request.json();
    const labels = String(body.items ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    await query("BEGIN");
    const template = await query<{ id: number }>(
      "INSERT INTO checklist_templates (name, description) VALUES ($1, $2) RETURNING id",
      [body.name, body.description ?? ""]
    );

    for (const [index, label] of labels.entries()) {
      await query(
        "INSERT INTO checklist_items (template_id, label, sort_order) VALUES ($1, $2, $3)",
        [template.rows[0].id, label, index + 1]
      );
    }

    await query("COMMIT");
    return NextResponse.json({ id: template.rows[0].id });
  } catch (error) {
    await query("ROLLBACK").catch(() => undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create checklist" },
      { status: 500 }
    );
  }
}
