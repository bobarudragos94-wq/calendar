import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { getEventByCode, getParticipants } from "@/lib/queries";
import type { EventPublic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events/[code] -> detaliile publice ale unui event.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  await ensureSchema();
  const ev = await getEventByCode(params.code);
  if (!ev) {
    return NextResponse.json({ error: "Event inexistent." }, { status: 404 });
  }
  const participants = await getParticipants(ev.id);
  const out: EventPublic = {
    code: ev.code,
    title: ev.title,
    startDate: ev.start_date,
    endDate: ev.end_date,
    dayStartMin: ev.day_start_min,
    dayEndMin: ev.day_end_min,
    slotMinutes: ev.slot_minutes,
    meetingMinutes: ev.meeting_minutes,
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
  };
  return NextResponse.json(out);
}
