import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health -> diagnostic pentru configurarea bazei de date.
// Nu expune secrete: doar dacă variabilele există și dacă baza răspunde.
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL ?? "";
  const hasUrl = url.length > 0;
  const hasToken = (process.env.TURSO_AUTH_TOKEN ?? "").length > 0;

  let dbOk = false;
  let error: string | null = null;

  if (hasUrl) {
    try {
      await ensureSchema();
      const r = await db().execute("SELECT 1 AS ok");
      dbOk = r.rows.length > 0;
    } catch (e: any) {
      error = e?.message ?? String(e);
    }
  } else {
    error = "TURSO_DATABASE_URL lipsește din environment.";
  }

  return NextResponse.json({
    hasUrl,
    hasToken,
    // doar schema URL-ului (ex. "libsql" / "file" / "https"), fără host sau secret
    urlScheme: hasUrl ? url.split(":")[0] : null,
    dbOk,
    error,
    ok: hasUrl && dbOk,
  });
}
