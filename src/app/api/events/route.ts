import { NextRequest, NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { daysBetween } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Caractere fara ambiguitate vizuala (fara 0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(len = 6): string {
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function isDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// POST /api/events -> creeaza un event nou si returneaza codul de join.
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          "Baza de date nu este configurată. Setează TURSO_DATABASE_URL și TURSO_AUTH_TOKEN.",
        detail: e?.message ?? String(e),
      },
      { status: 503 }
    );
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const { startDate, endDate } = body;
  const dayStartMin = Number(body.dayStartMin);
  const dayEndMin = Number(body.dayEndMin);
  const slotMinutes = Number(body.slotMinutes);
  const meetingMinutes = Number(body.meetingMinutes);

  if (!title) {
    return NextResponse.json({ error: "Titlul este obligatoriu." }, { status: 400 });
  }
  if (!isDate(startDate) || !isDate(endDate)) {
    return NextResponse.json({ error: "Datele perioadei sunt invalide." }, { status: 400 });
  }
  if (daysBetween(startDate, endDate) < 1) {
    return NextResponse.json(
      { error: "Data de final trebuie sa fie dupa data de start." },
      { status: 400 }
    );
  }
  if (daysBetween(startDate, endDate) > 60) {
    return NextResponse.json(
      { error: "Perioada este prea lunga (maxim 60 de zile)." },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(dayStartMin) ||
    !Number.isFinite(dayEndMin) ||
    dayStartMin < 0 ||
    dayEndMin > 1440 ||
    dayEndMin - dayStartMin < slotMinutes
  ) {
    return NextResponse.json(
      { error: "Fereastra orara zilnica este invalida." },
      { status: 400 }
    );
  }
  if (![15, 30, 60].includes(slotMinutes)) {
    return NextResponse.json({ error: "Granularitate invalida." }, { status: 400 });
  }
  if (!Number.isFinite(meetingMinutes) || meetingMinutes < slotMinutes) {
    return NextResponse.json({ error: "Durata meeting-ului este invalida." }, { status: 400 });
  }

  const client = db();
  const id = crypto.randomUUID();
  const ownerToken = crypto.randomUUID();
  const now = Date.now();

  try {
    // Genereaza un cod unic (reincercari daca exista coliziune).
    let code = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      code = makeCode();
      const existing = await client.execute({
        sql: "SELECT 1 FROM events WHERE code = ?",
        args: [code],
      });
      if (existing.rows.length === 0) break;
      code = "";
    }
    if (!code) {
      return NextResponse.json(
        { error: "Nu am putut genera un cod. Incearca din nou." },
        { status: 500 }
      );
    }

    await client.execute({
      sql: `INSERT INTO events
        (id, code, title, start_date, end_date, day_start_min, day_end_min, slot_minutes, meeting_minutes, owner_token, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        code,
        title,
        startDate,
        endDate,
        dayStartMin,
        dayEndMin,
        slotMinutes,
        meetingMinutes,
        ownerToken,
        now,
      ],
    });

    return NextResponse.json({ code, ownerToken });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Eroare la baza de date.", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
