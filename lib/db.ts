import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;
let schemaReady = false;

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getPool().query<T>(text, params);
}

export async function ensureSchema() {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS schedule_trainings (
      id SERIAL PRIMARY KEY,
      college_name TEXT NOT NULL,
      audience TEXT NOT NULL CHECK (audience IN ('boys', 'girls', 'mixed')),
      program_name TEXT NOT NULL,
      faculty_name TEXT NOT NULL,
      coordinator_name TEXT NOT NULL DEFAULT '',
      coordinator_phone TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      faculty_count INTEGER NOT NULL DEFAULT 1,
      participant_count INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
      start_session_label TEXT NOT NULL DEFAULT 'morning',
      start_session_start TIME NOT NULL DEFAULT '09:30',
      start_session_end TIME NOT NULL DEFAULT '12:30',
      end_session_label TEXT NOT NULL DEFAULT 'afternoon',
      end_session_start TIME NOT NULL DEFAULT '13:30',
      end_session_end TIME NOT NULL DEFAULT '16:30',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'postponed')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS venue TEXT NOT NULL DEFAULT '';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS faculty_count INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS start_session_label TEXT NOT NULL DEFAULT 'morning';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS start_session_start TIME NOT NULL DEFAULT '09:30';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS start_session_end TIME NOT NULL DEFAULT '12:30';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS end_session_label TEXT NOT NULL DEFAULT 'afternoon';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS end_session_start TIME NOT NULL DEFAULT '13:30';
    ALTER TABLE schedule_trainings ADD COLUMN IF NOT EXISTS end_session_end TIME NOT NULL DEFAULT '16:30';

    UPDATE schedule_trainings
    SET venue = CASE
        WHEN college_name = 'St. Marys College' AND venue = '' THEN 'Lab A'
        WHEN college_name = 'Riverside Engineering College' AND venue = '' THEN 'Lab B'
        WHEN college_name = 'North Valley Arts and Science' AND venue = '' THEN 'Seminar Hall'
        ELSE venue
      END,
      participant_count = CASE
        WHEN college_name = 'St. Marys College' AND participant_count = 0 THEN 48
        WHEN college_name = 'Riverside Engineering College' AND participant_count = 0 THEN 52
        WHEN college_name = 'North Valley Arts and Science' AND participant_count = 0 THEN 36
        ELSE participant_count
      END,
      faculty_count = CASE
        WHEN faculty_count = 0 THEN 1
        ELSE faculty_count
      END,
      priority = CASE
        WHEN college_name = 'St. Marys College' THEN 'high'
        ELSE priority
      END,
      status = CASE
        WHEN college_name = 'St. Marys College' THEN 'running'
        WHEN college_name IN ('Riverside Engineering College', 'North Valley Arts and Science') THEN 'scheduled'
        ELSE status
      END;

    CREATE TABLE IF NOT EXISTS schedule_sessions (
      id SERIAL PRIMARY KEY,
      training_id INTEGER NOT NULL REFERENCES schedule_trainings(id) ON DELETE CASCADE,
      session_name TEXT NOT NULL CHECK (session_name IN ('morning', 'afternoon', 'night')),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_todos (
      id SERIAL PRIMARY KEY,
      training_id INTEGER NOT NULL REFERENCES schedule_trainings(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS unavailable_dates (
      id SERIAL PRIMARY KEY,
      unavailable_date DATE NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  schemaReady = true;
}

export async function seedIfEmpty() {
  const { rows } = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM schedule_trainings"
  );

  if (Number(rows[0]?.count ?? 0) > 0) {
    return;
  }

  await query("BEGIN");
  try {
    const trainings = await query<{ id: number }>(`
      INSERT INTO schedule_trainings
        (college_name, audience, program_name, faculty_name, coordinator_name, coordinator_phone, venue, faculty_count, participant_count, priority, start_session_label, start_session_start, start_session_end, end_session_label, end_session_start, end_session_end, start_date, end_date, status, notes)
      VALUES
        ('St. Marys College', 'girls', 'Python Skill Training', 'Anika Rao', 'Divya S', '9876543210', 'Lab A', 2, 48, 'high', 'morning', '09:30', '12:30', 'afternoon', '13:30', '16:30', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '4 days', 'running', 'Lab access confirmed.'),
        ('Riverside Engineering College', 'boys', 'Full Stack Bootcamp', 'Harish Kumar', 'Manoj P', '9876501234', 'Lab B', 3, 52, 'normal', 'morning', '09:00', '12:00', 'afternoon', '13:00', '16:00', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '12 days', 'scheduled', 'Bring college ID list before day one.'),
        ('North Valley Arts and Science', 'mixed', 'AI Tools Workshop', 'Vikram Menon', 'Leena R', '9876512345', 'Seminar Hall', 1, 36, 'normal', 'afternoon', '13:30', '16:30', 'afternoon', '13:30', '16:30', CURRENT_DATE + INTERVAL '18 days', CURRENT_DATE + INTERVAL '22 days', 'scheduled', 'Faculty requested afternoon recap.')
      RETURNING id
    `);

    await query(
      `
      INSERT INTO schedule_sessions (training_id, session_name, start_time, end_time) VALUES
      ($1, 'morning', '09:30', '12:30'),
      ($1, 'afternoon', '13:30', '16:30'),
      ($2, 'morning', '09:00', '12:00'),
      ($2, 'afternoon', '13:00', '16:00'),
      ($3, 'afternoon', '13:30', '16:30')
    `,
      [trainings.rows[0].id, trainings.rows[1].id, trainings.rows[2].id]
    );

    await query(
      `
      INSERT INTO schedule_todos (training_id, label, done, sort_order) VALUES
      ($1, 'Attendance sheet collected', true, 1),
      ($1, 'Lab systems checked before morning session', true, 2),
      ($1, 'Daily feedback pending', false, 3),
      ($2, 'Confirm boys hostel arrival timing', false, 1),
      ($2, 'Share software setup file', false, 2),
      ($3, 'Collect participant list', false, 1)
    `,
      [trainings.rows[0].id, trainings.rows[1].id, trainings.rows[2].id]
    );

    await query(
      `
      INSERT INTO unavailable_dates (unavailable_date, reason) VALUES
      (CURRENT_DATE + INTERVAL '14 days', 'Festival holiday'),
      (CURRENT_DATE + INTERVAL '15 days', 'Maintenance block')
      ON CONFLICT (unavailable_date) DO NOTHING
    `
    );

    await query("COMMIT");
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}

export async function getScheduleOverview() {
  const [trainings, unavailable] = await Promise.all([
    query(`
      SELECT
        t.id,
        t.college_name,
        t.audience,
        t.program_name,
        t.faculty_name,
        t.coordinator_name,
        t.coordinator_phone,
        t.venue,
        t.faculty_count,
        t.participant_count,
        t.priority,
        t.start_session_label,
        LEFT(t.start_session_start::text, 5) AS start_session_start,
        LEFT(t.start_session_end::text, 5) AS start_session_end,
        t.end_session_label,
        LEFT(t.end_session_start::text, 5) AS end_session_start,
        LEFT(t.end_session_end::text, 5) AS end_session_end,
        to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
        to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
        t.status,
        t.notes,
        t.created_at,
        t.updated_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', s.id,
            'sessionName', s.session_name,
            'startTime', LEFT(s.start_time::text, 5),
            'endTime', LEFT(s.end_time::text, 5)
          )) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS sessions,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', td.id,
            'label', td.label,
            'done', td.done,
            'sortOrder', td.sort_order
          )) FILTER (WHERE td.id IS NOT NULL),
          '[]'
        ) AS todos
      FROM schedule_trainings t
      LEFT JOIN schedule_sessions s ON s.training_id = t.id
      LEFT JOIN schedule_todos td ON td.training_id = t.id
      GROUP BY t.id
      ORDER BY t.start_date ASC
    `),
    query(`
      SELECT id, to_char(unavailable_date, 'YYYY-MM-DD') AS unavailable_date, reason, created_at
      FROM unavailable_dates
      ORDER BY unavailable_date ASC
    `)
  ]);

  return {
    trainings: trainings.rows,
    unavailableDates: unavailable.rows
  };
}

export async function createTraining(body: Record<string, unknown>) {
  await query("BEGIN");
  try {
    const training = await query<{ id: number }>(
      `
      INSERT INTO schedule_trainings
        (college_name, audience, program_name, faculty_name, coordinator_name, coordinator_phone, venue, faculty_count, participant_count, priority, start_session_label, start_session_start, start_session_end, end_session_label, end_session_start, end_session_end, start_date, end_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id
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
        body.startDate,
        body.endDate,
        body.notes ?? ""
      ]
    );

    const id = training.rows[0].id;
    const sessions = Array.isArray(body.sessions) ? body.sessions : [];
    for (const session of sessions as Record<string, string>[]) {
      if (!session.enabled) continue;
      await query(
        `
        INSERT INTO schedule_sessions (training_id, session_name, start_time, end_time)
        VALUES ($1, $2, $3, $4)
      `,
        [id, session.name, session.startTime, session.endTime]
      );
    }

    const todos = String(body.todos ?? "")
      .split("\n")
      .map((todo) => todo.trim())
      .filter(Boolean);

    for (const [index, label] of todos.entries()) {
      await query(
        "INSERT INTO schedule_todos (training_id, label, sort_order) VALUES ($1, $2, $3)",
        [id, label, index + 1]
      );
    }

    await query("COMMIT");
    return id;
  } catch (error) {
    await query("ROLLBACK");
    throw error;
  }
}
