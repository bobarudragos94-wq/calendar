import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { getEventByCode } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/events/[code]/join { name } -> creeaza un participant si returneaza token-ul.
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  await ensureSchema();
  const ev = await getEventByCode(params.code);
  if (!ev) {
    return NextResponse.json({ error: "Event inexistent." }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Numele este obligatoriu." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "Numele este prea lung." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  await db().execute({
    sql: `INSERT INTO participants (id, event_id, name, token, slots, created_at)
          VALUES (?, ?, ?, ?, '[]', ?)`,
    args: [id, ev.id, name, token, Date.now()],
  });

  return NextResponse.json({ participantId: id, token, name });
}
