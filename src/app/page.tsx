"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MEETING_OPTIONS = [
  { label: "30 minute", value: 30 },
  { label: "1 oră", value: 60 },
  { label: "1 oră 30 min", value: 90 },
  { label: "2 ore", value: 120 },
  { label: "3 ore", value: 180 },
  { label: "4 ore", value: 240 },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function addDaysStr(base: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Parseaza raspunsul ca JSON in siguranta; nu arunca daca body-ul e gol/HTML. */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function HomePage() {
  const router = useRouter();
  const today = todayStr();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysStr(today, 6));
  const [dayStart, setDayStart] = useState("09:00");
  const [dayEnd, setDayEnd] = useState("22:00");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [meetingMinutes, setMeetingMinutes] = useState(60);

  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Dă un titlu event-ului.");
    if (endDate < startDate) return setError("Data de final e înainte de start.");
    if (timeToMin(dayEnd) - timeToMin(dayStart) < slotMinutes)
      return setError("Fereastra orară zilnică e prea scurtă.");

    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          startDate,
          endDate,
          dayStartMin: timeToMin(dayStart),
          dayEndMin: timeToMin(dayEnd),
          slotMinutes,
          meetingMinutes,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok || !data?.code) {
        const base = data?.error || `Eroare la creare (${res.status}).`;
        throw new Error(data?.detail ? `${base} (${data.detail})` : base);
      }
      try {
        localStorage.setItem(`owner:${data.code}`, data.ownerToken);
      } catch {}
      router.push(`/e/${data.code}`);
    } catch (err: any) {
      setError(err.message || "Eroare la creare.");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return setError("Introdu un cod valid.");
    router.push(`/e/${code}`);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-lg shadow-brand-600/30">
          🗓️
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Când ne vedem?</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Fiecare își pune programul liber, aplicația găsește când sunteți toți liberi.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Alatura-te cu un cod */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Ai un cod de join?
        </h2>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ex. K7P2QX"
            maxLength={8}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-lg tracking-widest uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Intră
          </button>
        </form>
      </section>

      <div className="relative my-6 text-center">
        <span className="relative z-10 bg-slate-50 px-3 text-xs font-medium uppercase tracking-wider text-slate-400 dark:bg-slate-950">
          sau creează un event nou
        </span>
        <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* Creeaza event */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Titlu</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex. Ieșire în weekend"
              maxLength={80}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Perioada</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Fereastra orară zilnică
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={dayStart}
                step={900}
                onChange={(e) => setDayStart(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-slate-400">→</span>
              <input
                type="time"
                value={dayEnd}
                step={900}
                onChange={(e) => setDayEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Intervalul afișat în grilă (ex. doar orele rezonabile).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Durata meeting-ului</label>
              <select
                value={meetingMinutes}
                onChange={(e) => setMeetingMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
              >
                {MEETING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Granularitate</label>
              <select
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={30}>30 minute</option>
                <option value={60}>60 minute</option>
                <option value={15}>15 minute</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-xl bg-brand-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? "Se creează…" : "Creează event & obține codul"}
          </button>
        </form>
      </section>

      <footer className="mt-8 text-center text-xs text-slate-400">
        PWA · funcționează și instalat pe telefon
      </footer>
    </main>
  );
}
