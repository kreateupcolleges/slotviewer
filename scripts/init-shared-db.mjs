import { neon } from "@neondatabase/serverless";

const ownerUrl = process.env.DATABASE_URL;
const appPassword = process.env.SLOTVIEWER_APP_PASSWORD;

if (!ownerUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!appPassword) {
  throw new Error("SLOTVIEWER_APP_PASSWORD is required.");
}

const sql = neon(ownerUrl);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

await sql`
  CREATE TABLE IF NOT EXISTS slotviewer_state (
    id text PRIMARY KEY,
    payload jsonb NOT NULL,
    version integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql.query(
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'slotviewer_app') THEN
      CREATE ROLE slotviewer_app LOGIN PASSWORD ${sqlLiteral(appPassword)};
    ELSE
      ALTER ROLE slotviewer_app PASSWORD ${sqlLiteral(appPassword)};
    END IF;
  END
  $$;`
);

await sql`GRANT USAGE ON SCHEMA public TO slotviewer_app`;
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE slotviewer_state TO slotviewer_app`;

await sql`
  INSERT INTO slotviewer_state (id, payload, version)
  VALUES ('production', ${JSON.stringify({ trainings: [], unavailableDates: [] })}::jsonb, 1)
  ON CONFLICT (id) DO NOTHING
`;

console.log("Shared slotviewer database is ready.");
