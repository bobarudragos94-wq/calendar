import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { getEventByCode, getParticipants, toEventPublic } from "@/lib/queries";
import { computeResults } from "@/lib/results";
import type { ResultsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events/[code]/results -> suprapunerile de disponibilitate.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  await ensureSchema();
  const ev = await getEventByCode(params.code);
  if (!ev) return NextResponse.json({ error: "Event inexistent." }, { status: 404 });

  const participants = await getParticipants(ev.id);
  const availabilities: number[][] = participants.map((p) => {
    try {
      const arr = JSON.parse(p.slots);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  const spec = {
    startDate: ev.start_date,
    endDate: ev.end_date,
    dayStartMin: ev.day_start_min,
    dayEndMin: ev.day_end_min,
    slotMinutes: ev.slot_minutes,
  };
  const { counts, common } = computeResults(spec, ev.meeting_minutes, availabilities);

  const out: ResultsResponse = {
    event: toEventPublic(ev, participants),
    total: participants.length,
    counts,
    common,
    availability: participants.map((p, i) => ({
      name: p.name,
      slots: availabilities[i],
    })),
  };
  return NextResponse.json(out);
}
