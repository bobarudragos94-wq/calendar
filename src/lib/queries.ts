import { db } from "@/lib/db";
import type { EventRow, ParticipantRow } from "@/lib/types";

export async function getEventByCode(code: string): Promise<EventRow | null> {
  const res = await db().execute({
    sql: "SELECT * FROM events WHERE code = ?",
    args: [code.toUpperCase()],
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as EventRow;
}

export async function getParticipants(eventId: string): Promise<ParticipantRow[]> {
  const res = await db().execute({
    sql: "SELECT * FROM participants WHERE event_id = ? ORDER BY created_at ASC",
    args: [eventId],
  });
  return res.rows as unknown as ParticipantRow[];
}
