import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { getEventByCode } from "@/lib/queries";
import { minutesToLabel } from "@/lib/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/events/[code]/ics?date=YYYY-MM-DD&start=<min>&end=<min>
// Genereaza un fisier .ics (iCalendar). Daca lipsesc parametrii, foloseste
// ora aleasa de organizator. Pe iPhone deschide Calendar, pe Android Google Calendar.

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// "YYYY-MM-DD" + minute -> "YYYYMMDDTHHMMSS" (ora locala flotanta, fara fus)
function toIcsLocal(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = date.replace(/-/g, "");
  return `${d}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

function nowStampUtc(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  await ensureSchema();
  const ev = await getEventByCode(params.code);
  if (!ev) return NextResponse.json({ error: "Event inexistent." }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  let date = sp.get("date") ?? "";
  let startMin = sp.has("start") ? Number(sp.get("start")) : NaN;
  let endMin = sp.has("end") ? Number(sp.get("end")) : NaN;

  // Fallback la ora aleasa de organizator.
  if (!date || !Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    if (ev.chosen_date != null && ev.chosen_start_min != null && ev.chosen_end_min != null) {
      date = ev.chosen_date;
      startMin = ev.chosen_start_min;
      endMin = ev.chosen_end_min;
    } else {
      return NextResponse.json({ error: "Niciun interval specificat." }, { status: 400 });
    }
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isInteger(startMin) ||
    !Number.isInteger(endMin) ||
    endMin <= startMin ||
    startMin < 0 ||
    endMin > 1440
  ) {
    return NextResponse.json({ error: "Interval invalid." }, { status: 400 });
  }

  const uid = `${ev.code}-${date}-${startMin}-${endMin}@cand-ne-vedem`;
  const summary = escapeText(ev.title);
  const desc = escapeText(
    `Meeting stabilit prin „Când ne vedem?” · ${minutesToLabel(startMin)}–${minutesToLabel(
      endMin
    )}\nCod grup: ${ev.code}`
  );

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cand ne vedem//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowStampUtc()}`,
    `DTSTART:${toIcsLocal(date, startMin)}`,
    `DTEND:${toIcsLocal(date, endMin)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const body = lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${ev.code}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
