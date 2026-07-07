import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getEventByCode } from "@/lib/queries";
import { buildGrid } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/events/[code]/choose
//   { ownerToken, date, startMin, endMin }  -> seteaza ora finala
//   { ownerToken, clear: true }             -> anuleaza alegerea
// Doar organizatorul (owner_token) poate alege.
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

  if (body.ownerToken !== ev.owner_token) {
    return NextResponse.json(
      { error: "Doar organizatorul poate alege ora." },
      { status: 403 }
    );
  }

  if (body.clear === true) {
    await db().execute({
      sql: "UPDATE events SET chosen_date = NULL, chosen_start_min = NULL, chosen_end_min = NULL WHERE id = ?",
      args: [ev.id],
    });
    return NextResponse.json({ ok: true, chosen: null });
  }

  const date = typeof body.date === "string" ? body.date : "";
  const startMin = Number(body.startMin);
  const endMin = Number(body.endMin);

  const grid = buildGrid({
    startDate: ev.start_date,
    endDate: ev.end_date,
    dayStartMin: ev.day_start_min,
    dayEndMin: ev.day_end_min,
    slotMinutes: ev.slot_minutes,
  });

  const validDate = grid.days.includes(date);
  const validTimes =
    Number.isInteger(startMin) &&
    Number.isInteger(endMin) &&
    startMin >= ev.day_start_min &&
    endMin <= ev.day_end_min &&
    endMin > startMin;

  if (!validDate || !validTimes) {
    return NextResponse.json({ error: "Interval invalid." }, { status: 400 });
  }

  await db().execute({
    sql: "UPDATE events SET chosen_date = ?, chosen_start_min = ?, chosen_end_min = ? WHERE id = ?",
    args: [date, startMin, endMin, ev.id],
  });

  return NextResponse.json({ ok: true, chosen: { date, startMin, endMin } });
}
