import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { getEventByCode, getParticipants, toEventPublic } from "@/lib/queries";

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
  return NextResponse.json(toEventPublic(ev, participants));
}
