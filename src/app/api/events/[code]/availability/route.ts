import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getEventByCode } from "@/lib/queries";
import { buildGrid } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadParticipant(eventId: string, token: string) {
  const res = await db().execute({
    sql: "SELECT * FROM participants WHERE event_id = ? AND token = ?",
    args: [eventId, token],
  });
  return res.rows[0] as any | undefined;
}

// GET /api/events/[code]/availability?token=... -> sloturile proprii.
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  await ensureSchema();
  const ev = await getEventByCode(params.code);
  if (!ev) return NextResponse.json({ error: "Event inexistent." }, { status: 404 });

  const token = req.nextUrl.searchParams.get("token") ?? "";
  const p = await loadParticipant(ev.id, token);
  if (!p) return NextResponse.json({ error: "Participant inexistent." }, { status: 404 });

  let slots: number[] = [];
  try {
    slots = JSON.parse(p.slots);
  } catch {
    slots = [];
  }
  return NextResponse.json({ name: p.name, slots });
}

// POST /api/events/[code]/availability { token, slots } -> salveaza disponibilitatea.
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  await ensureSchema();
  const ev = await getEventByCode(params.code);
  if (!ev) return NextResponse.json({ error: "Event inexistent." }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const p = await loadParticipant(ev.id, token);
  if (!p) return NextResponse.json({ error: "Participant inexistent." }, { status: 404 });

  const grid = buildGrid({
    startDate: ev.start_date,
    endDate: ev.end_date,
    dayStartMin: ev.day_start_min,
    dayEndMin: ev.day_end_min,
    slotMinutes: ev.slot_minutes,
  });

  // Curata si valideaza indicii de slot.
  const raw = Array.isArray(body.slots) ? body.slots : [];
  const clean = Array.from(
    new Set(
      raw
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isInteger(n) && n >= 0 && n < grid.totalSlots)
    )
  ).sort((a, b) => (a as number) - (b as number));

  await db().execute({
    sql: "UPDATE participants SET slots = ? WHERE id = ?",
    args: [JSON.stringify(clean), p.id],
  });

  return NextResponse.json({ ok: true, count: clean.length });
}
