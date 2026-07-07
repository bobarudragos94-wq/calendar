import { db } from "@/lib/db";
import type { EventRow, EventPublic, ParticipantRow } from "@/lib/types";

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

/** Construieste reprezentarea publica a unui event. */
export function toEventPublic(ev: EventRow, participants: ParticipantRow[]): EventPublic {
  const hasChosen =
    ev.chosen_date != null &&
    ev.chosen_start_min != null &&
    ev.chosen_end_min != null;
  return {
    code: ev.code,
    title: ev.title,
    startDate: ev.start_date,
    endDate: ev.end_date,
    dayStartMin: ev.day_start_min,
    dayEndMin: ev.day_end_min,
    slotMinutes: ev.slot_minutes,
    meetingMinutes: ev.meeting_minutes,
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
    chosen: hasChosen
      ? {
          date: ev.chosen_date as string,
          startMin: ev.chosen_start_min as number,
          endMin: ev.chosen_end_min as number,
        }
      : null,
  };
}
