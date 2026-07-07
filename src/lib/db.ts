import { createClient, type Client } from "@libsql/client";

// Conexiunea la Turso (libSQL). Configurata prin variabilele de mediu:
//   TURSO_DATABASE_URL  (ex. libsql://nume-baza.turso.io)
//   TURSO_AUTH_TOKEN
//
// Pentru dezvoltare locala se poate folosi si un fisier local:
//   TURSO_DATABASE_URL=file:local.db

let _client: Client | null = null;
let _schemaReady: Promise<void> | null = null;

function getClient(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL nu este setat. Configureaza variabilele de mediu (vezi .env.example)."
    );
  }
  _client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _client;
}

/** Creeaza tabelele daca nu exista. Idempotent, memoizat per-instanta. */
export function ensureSchema(): Promise<void> {
  if (_schemaReady) return _schemaReady;
  const client = getClient();
  _schemaReady = (async () => {
    await client.batch(
      [
        `CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          day_start_min INTEGER NOT NULL,
          day_end_min INTEGER NOT NULL,
          slot_minutes INTEGER NOT NULL,
          meeting_minutes INTEGER NOT NULL,
          owner_token TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS participants (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          name TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          slots TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          FOREIGN KEY (event_id) REFERENCES events(id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id)`,
      ],
      "write"
    );
  })().catch((e) => {
    // Permite reincercarea la urmatorul request daca a esuat.
    _schemaReady = null;
    throw e;
  });
  return _schemaReady;
}

export function db(): Client {
  return getClient();
}
