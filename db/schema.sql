-- Schema pentru „Când ne vedem?".
-- NOTĂ: aplicația creează aceste tabele automat la primul request
-- (CREATE TABLE IF NOT EXISTS în src/lib/db.ts), deci acest fișier e
-- opțional — util doar dacă vrei să inițializezi baza manual.

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  start_date      TEXT NOT NULL,          -- YYYY-MM-DD
  end_date        TEXT NOT NULL,          -- YYYY-MM-DD
  day_start_min   INTEGER NOT NULL,       -- minute de la miezul nopții
  day_end_min     INTEGER NOT NULL,
  slot_minutes    INTEGER NOT NULL,       -- granularitate (ex. 30)
  meeting_minutes INTEGER NOT NULL,       -- durata minimă a meeting-ului
  owner_token     TEXT NOT NULL,          -- secret organizator
  created_at      INTEGER NOT NULL,
  chosen_date     TEXT,                   -- ora finală aleasă (opțional)
  chosen_start_min INTEGER,
  chosen_end_min  INTEGER
);

CREATE TABLE IF NOT EXISTS participants (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,        -- secret participant
  slots      TEXT NOT NULL DEFAULT '[]',  -- JSON: number[] cu indici de slot liberi
  created_at INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
