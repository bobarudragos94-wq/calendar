"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  buildGrid,
  minutesToLabel,
  formatDayLabel,
  formatDateLong,
} from "@/lib/slots";
import type { EventPublic, ResultsResponse } from "@/lib/types";

type Tab = "me" | "results";

export default function EventClient({ code }: { code: string }) {
  const [event, setEvent] = useState<EventPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [joining, setJoining] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [tab, setTab] = useState<Tab>("me");
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // --- incarcare event + sesiune locala ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/events/${code}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Event inexistent.");
        }
        const data: EventPublic = await res.json();
        if (!alive) return;
        setEvent(data);
      } catch (e: any) {
        if (alive) setLoadError(e.message || "Eroare la încărcare.");
      }
    })();
    // sesiunea locala
    try {
      const t = localStorage.getItem(`participant:${code}`);
      const n = localStorage.getItem(`participantName:${code}`);
      const o = localStorage.getItem(`owner:${code}`);
      if (t) setToken(t);
      if (n) setMyName(n);
      if (o) setOwnerToken(o);
    } catch {}
    return () => {
      alive = false;
    };
  }, [code]);

  // --- incarcare disponibilitate proprie dupa ce avem token ---
  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/events/${code}/availability?token=${token}`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.slots)) setSelected(new Set<number>(data.slots));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [token, code]);

  const grid = useMemo(() => {
    if (!event) return null;
    return buildGrid({
      startDate: event.startDate,
      endDate: event.endDate,
      dayStartMin: event.dayStartMin,
      dayEndMin: event.dayEndMin,
      slotMinutes: event.slotMinutes,
    });
  }, [event]);

  // --- salvare (debounced) ---
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSave = useCallback(async () => {
    if (!token) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/events/${code}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slots: Array.from(selectedRef.current) }),
      });
      if (!res.ok) throw new Error();
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [token, code]);

  const scheduleSave = useCallback(() => {
    if (!token) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 700);
  }, [doSave, token]);

  const flushSave = useCallback(async () => {
    if (!token) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await doSave();
  }, [doSave, token]);

  // --- pictare grila ---
  const dragging = useRef(false);
  const paintValue = useRef(false);
  const lastPointerType = useRef<string>("mouse");

  const applyPaint = useCallback(
    (idx: number, value: boolean) => {
      setSelected((prev) => {
        if (value === prev.has(idx)) return prev;
        const next = new Set(prev);
        if (value) next.add(idx);
        else next.delete(idx);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        scheduleSave();
      }
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [scheduleSave]);

  const onCellPointerDown = (idx: number, e: React.PointerEvent) => {
    lastPointerType.current = e.pointerType;
    if (e.pointerType === "mouse") {
      e.preventDefault();
      paintValue.current = !selectedRef.current.has(idx);
      dragging.current = true;
      applyPaint(idx, paintValue.current);
    }
  };
  const onCellPointerEnter = (idx: number) => {
    if (dragging.current) applyPaint(idx, paintValue.current);
  };
  const onCellClick = (idx: number) => {
    // Pe mouse, pointerdown deja a gestionat; evitam dublarea.
    if (lastPointerType.current === "mouse") return;
    const value = !selectedRef.current.has(idx);
    applyPaint(idx, value);
    scheduleSave();
  };

  // toggle o zi intreaga
  const toggleDay = (dayIndex: number) => {
    if (!grid) return;
    const base = dayIndex * grid.slotsPerDay;
    const idxs = Array.from({ length: grid.slotsPerDay }, (_, t) => base + t);
    const allSet = idxs.every((i) => selectedRef.current.has(i));
    setSelected((prev) => {
      const next = new Set(prev);
      idxs.forEach((i) => (allSet ? next.delete(i) : next.add(i)));
      return next;
    });
    scheduleSave();
  };
  // toggle un rand (aceeasi ora, toate zilele)
  const toggleTimeRow = (timeIndex: number) => {
    if (!grid) return;
    const idxs = grid.days.map((_, d) => d * grid.slotsPerDay + timeIndex);
    const allSet = idxs.every((i) => selectedRef.current.has(i));
    setSelected((prev) => {
      const next = new Set(prev);
      idxs.forEach((i) => (allSet ? next.delete(i) : next.add(i)));
      return next;
    });
    scheduleSave();
  };

  // --- join ---
  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/events/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare.");
      try {
        localStorage.setItem(`participant:${code}`, data.token);
        localStorage.setItem(`participantName:${code}`, data.name);
      } catch {}
      setToken(data.token);
      setMyName(data.name);
      // reincarca lista de participanti
      refreshEvent();
    } catch (e) {
      /* noop */
    } finally {
      setJoining(false);
    }
  }

  async function refreshEvent() {
    try {
      const res = await fetch(`/api/events/${code}`);
      if (res.ok) setEvent(await res.json());
    } catch {}
  }

  // --- rezultate ---
  async function loadResults() {
    await flushSave();
    try {
      const res = await fetch(`/api/events/${code}/results`);
      if (res.ok) setResults(await res.json());
    } catch {}
  }
  useEffect(() => {
    if (tab === "results") loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function switchTab(t: Tab) {
    if (t === tab) return;
    if (tab === "me") await flushSave();
    setTab(t);
  }

  // --- share ---
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/e/${code}` : "";
  async function copyShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title || "Când ne vedem?",
          text: `Intră cu codul ${code} și pune-ți programul liber:`,
          url: shareUrl,
        });
        return;
      }
    } catch {
      /* fallback la clipboard */
    }
    try {
      await navigator.clipboard.writeText(`${shareUrl}  (cod: ${code})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  // --- render ---
  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="mb-3 text-4xl">🤷</div>
        <h1 className="text-xl font-bold">{loadError}</h1>
        <p className="mt-2 text-sm text-slate-500">Verifică codul și încearcă din nou.</p>
        <Link
          href="/"
          className="mt-6 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white"
        >
          Înapoi acasă
        </Link>
      </main>
    );
  }

  if (!event || !grid) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        Se încarcă…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-5 sm:px-4">
      {/* Header + share */}
      <div className="mb-4">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← acasă
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold leading-tight">{event.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatDateLong(event.startDate)} – {formatDateLong(event.endDate)} ·{" "}
              {minutesToLabel(event.dayStartMin)}–{minutesToLabel(event.dayEndMin)} · meeting{" "}
              {formatDuration(event.meetingMinutes)}
            </p>
          </div>
          <button
            onClick={copyShare}
            className="shrink-0 rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-right dark:border-brand-800 dark:bg-brand-950"
          >
            <div className="text-[10px] font-medium uppercase tracking-wider text-brand-600 dark:text-brand-300">
              cod de join
            </div>
            <div className="font-mono text-lg font-bold tracking-widest text-brand-700 dark:text-brand-200">
              {code}
            </div>
            <div className="text-[10px] text-brand-500">
              {copied ? "copiat!" : "apasă pt. share"}
            </div>
          </button>
        </div>
      </div>

      {/* Participanti */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {event.participants.length === 0 && (
          <span className="text-sm text-slate-400">Încă niciun participant.</span>
        )}
        {event.participants.map((p) => (
          <span
            key={p.id}
            className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
        <button
          onClick={() => switchTab("me")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            tab === "me"
              ? "bg-white text-slate-900 shadow dark:bg-slate-950 dark:text-white"
              : "text-slate-500"
          }`}
        >
          Programul meu
        </button>
        <button
          onClick={() => switchTab("results")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            tab === "results"
              ? "bg-white text-slate-900 shadow dark:bg-slate-950 dark:text-white"
              : "text-slate-500"
          }`}
        >
          Rezultate
        </button>
      </div>

      {tab === "me" ? (
        !token ? (
          <JoinForm
            nameInput={nameInput}
            setNameInput={setNameInput}
            joining={joining}
            onSubmit={handleJoin}
          />
        ) : (
          <MyAvailability
            grid={grid}
            selected={selected}
            myName={myName}
            saveStatus={saveStatus}
            onCellPointerDown={onCellPointerDown}
            onCellPointerEnter={onCellPointerEnter}
            onCellClick={onCellClick}
            toggleDay={toggleDay}
            toggleTimeRow={toggleTimeRow}
          />
        )
      ) : (
        <ResultsView
          grid={grid}
          results={results}
          code={code}
          meetingMinutes={event.meetingMinutes}
          ownerToken={ownerToken}
          onRefresh={loadResults}
        />
      )}
    </main>
  );
}

/* ---------- helpers de formatare ---------- */

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

/* ---------- Join form ---------- */

function JoinForm({
  nameInput,
  setNameInput,
  joining,
  onSubmit,
}: {
  nameInput: string;
  setNameInput: (s: string) => void;
  joining: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 text-3xl">👋</div>
      <h2 className="text-lg font-bold">Cum te cheamă?</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Numele apare în listă ca ceilalți să știe cine și-a pus programul.
      </p>
      <form onSubmit={onSubmit} className="mx-auto flex max-w-xs flex-col gap-2">
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Numele tău"
          maxLength={40}
          autoFocus
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          disabled={joining || !nameInput.trim()}
          className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {joining ? "Se intră…" : "Intru în grup"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Grila mea ---------- */

function MyAvailability({
  grid,
  selected,
  myName,
  saveStatus,
  onCellPointerDown,
  onCellPointerEnter,
  onCellClick,
  toggleDay,
  toggleTimeRow,
}: {
  grid: ReturnType<typeof buildGrid>;
  selected: Set<number>;
  myName: string | null;
  saveStatus: string;
  onCellPointerDown: (idx: number, e: React.PointerEvent) => void;
  onCellPointerEnter: (idx: number) => void;
  onCellClick: (idx: number) => void;
  toggleDay: (d: number) => void;
  toggleTimeRow: (t: number) => void;
}) {
  const statusText: Record<string, string> = {
    idle: "",
    saving: "Se salvează…",
    saved: "✓ Salvat",
    error: "⚠ Eroare la salvare",
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {myName && <span className="font-medium text-slate-700 dark:text-slate-200">{myName}</span>}
          {myName ? " — a" : "A"}pasă/trage peste orele în care ești{" "}
          <span className="font-semibold text-emerald-600">liber</span>.
        </p>
        <span
          className={`text-xs ${
            saveStatus === "error" ? "text-red-500" : "text-slate-400"
          }`}
        >
          {statusText[saveStatus]}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-400">
        Tip: apasă pe o zi (sus) sau pe o oră (stânga) ca s-o (de)selectezi întreagă.
      </p>
      <Grid
        grid={grid}
        mode="edit"
        selected={selected}
        onCellPointerDown={onCellPointerDown}
        onCellPointerEnter={onCellPointerEnter}
        onCellClick={onCellClick}
        toggleDay={toggleDay}
        toggleTimeRow={toggleTimeRow}
      />
    </div>
  );
}

/* ---------- Rezultate ---------- */

function ResultsView({
  grid,
  results,
  code,
  meetingMinutes,
  ownerToken,
  onRefresh,
}: {
  grid: ReturnType<typeof buildGrid>;
  results: ResultsResponse | null;
  code: string;
  meetingMinutes: number;
  ownerToken: string | null;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = !!ownerToken;

  async function choose(date: string, startMin: number, intervalEnd: number) {
    if (!ownerToken) return;
    setBusy(true);
    // Blocul de meeting incepe la startul intervalului, cu durata ceruta
    // (limitat la finalul intervalului comun).
    const endMin = Math.min(startMin + meetingMinutes, intervalEnd);
    try {
      const res = await fetch(`/api/events/${code}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, date, startMin, endMin }),
      });
      if (res.ok) await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearChoice() {
    if (!ownerToken) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${code}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, clear: true }),
      });
      if (res.ok) await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  if (!results) {
    return <div className="py-10 text-center text-slate-400">Se calculează…</div>;
  }

  const { total, counts, common, availability } = results;
  const chosen = results.event.chosen;
  const title = results.event.title;
  const fitting = common.filter((c) => c.fitsMeeting);

  return (
    <div>
      {/* Banner ora aleasa + adaugare in calendar */}
      {chosen && (
        <div className="mb-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 dark:border-emerald-600 dark:bg-emerald-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                ✓ Ora stabilită
              </div>
              <div className="mt-0.5 text-lg font-bold capitalize">
                {formatDateLong(chosen.date)}
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {minutesToLabel(chosen.startMin)} – {minutesToLabel(chosen.endMin)}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={clearChoice}
                disabled={busy}
                className="shrink-0 text-xs text-slate-400 underline hover:text-slate-600"
              >
                anulează
              </button>
            )}
          </div>
          <AddToCalendar
            code={code}
            title={title}
            date={chosen.date}
            startMin={chosen.startMin}
            endMin={chosen.endMin}
          />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {total === 0
            ? "Nimeni nu și-a pus programul încă."
            : `${total} ${total === 1 ? "participant" : "participanți"} · verde închis = toți liberi`}
        </p>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ↻ Reîmprospătează
        </button>
      </div>

      {/* Heatmap */}
      <Grid
        grid={grid}
        mode="heat"
        counts={counts}
        total={total}
        onCellClick={(idx) => setDetail(idx === detail ? null : idx)}
        activeCell={detail}
      />

      {/* Detaliu slot selectat */}
      {detail !== null && total > 0 && (
        <SlotDetail
          grid={grid}
          idx={detail}
          availability={availability}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Lista intervale comune */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Intervale în care sunteți toți liberi
        </h3>
        {total === 0 ? (
          <p className="text-sm text-slate-400">
            Dă codul prietenilor și rugați-i să-și pună programul.
          </p>
        ) : common.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Nu există niciun interval liber comun în perioada asta. 😕
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {fitting.length > 0 ? (
                <>
                  <span className="font-semibold text-emerald-600">{fitting.length}</span>{" "}
                  {fitting.length === 1 ? "interval încape" : "intervale încap"} pentru meeting-ul
                  de {formatDuration(meetingMinutes)}.
                </>
              ) : (
                <>
                  Există suprapuneri, dar niciuna ≥ {formatDuration(meetingMinutes)}. Cele mai lungi
                  sunt marcate mai jos.
                </>
              )}
            </p>
            {isOwner && !chosen && (
              <p className="mb-2 text-xs text-slate-400">
                Ești organizatorul — apasă <span className="font-medium">„Alege”</span> pe intervalul
                dorit ca să-l fixezi pentru toți.
              </p>
            )}
            <ul className="space-y-2">
              {common.map((c, i) => {
                const isChosen =
                  !!chosen && chosen.date === c.date && chosen.startMin === c.startMin;
                return (
                  <li
                    key={i}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      isChosen
                        ? "border-emerald-400 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-900"
                        : c.fitsMeeting
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold capitalize">
                        {formatDateLong(c.date)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        {minutesToLabel(c.startMin)} – {minutesToLabel(c.endMin)}
                        <span
                          className={`ml-2 font-bold ${
                            c.fitsMeeting ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          {formatDuration(c.durationMin)}
                          {c.fitsMeeting ? " ✓" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isChosen ? (
                        <span className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
                          ✓ Ales
                        </span>
                      ) : isOwner ? (
                        <button
                          onClick={() => choose(c.date, c.startMin, c.endMin)}
                          disabled={busy}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                        >
                          Alege
                        </button>
                      ) : (
                        <a
                          href={`/api/events/${code}/ics?date=${c.date}&start=${c.startMin}&end=${c.endMin}`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          📅 Adaugă
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function SlotDetail({
  grid,
  idx,
  availability,
  onClose,
}: {
  grid: ReturnType<typeof buildGrid>;
  idx: number;
  availability: { name: string; slots: number[] }[];
  onClose: () => void;
}) {
  const dayIndex = Math.floor(idx / grid.slotsPerDay);
  const timeIndex = idx % grid.slotsPerDay;
  const date = grid.days[dayIndex];
  const startMin = grid.timeStarts[timeIndex];
  const free = availability.filter((a) => a.slots.includes(idx)).map((a) => a.name);
  const busy = availability.filter((a) => !a.slots.includes(idx)).map((a) => a.name);
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold capitalize">
          {formatDateLong(date)}, {minutesToLabel(startMin)}–
          {minutesToLabel(startMin + grid.slotMinutes)}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>
      <div className="space-y-1">
        <div>
          <span className="font-medium text-emerald-600">Liberi:</span>{" "}
          {free.length ? free.join(", ") : "—"}
        </div>
        <div>
          <span className="font-medium text-slate-400">Ocupați:</span>{" "}
          {busy.length ? busy.join(", ") : "—"}
        </div>
      </div>
    </div>
  );
}

/* ---------- Grila (reutilizabila) ---------- */

function Grid({
  grid,
  mode,
  selected,
  counts,
  total,
  activeCell,
  onCellPointerDown,
  onCellPointerEnter,
  onCellClick,
  toggleDay,
  toggleTimeRow,
}: {
  grid: ReturnType<typeof buildGrid>;
  mode: "edit" | "heat";
  selected?: Set<number>;
  counts?: number[];
  total?: number;
  activeCell?: number | null;
  onCellPointerDown?: (idx: number, e: React.PointerEvent) => void;
  onCellPointerEnter?: (idx: number) => void;
  onCellClick?: (idx: number) => void;
  toggleDay?: (d: number) => void;
  toggleTimeRow?: (t: number) => void;
}) {
  const nDays = grid.days.length;
  // Afiseaza eticheta orei doar la inceput de ora (sau la fiecare rand daca slot >= 60).
  const showEvery = grid.slotMinutes >= 60 ? 1 : Math.round(60 / grid.slotMinutes);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div
        className="no-select grid min-w-max text-center"
        style={{
          gridTemplateColumns: `52px repeat(${nDays}, minmax(38px, 1fr))`,
        }}
      >
        {/* colt */}
        <div className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        {/* header zile */}
        {grid.days.map((d, di) => {
          const lbl = formatDayLabel(d);
          const header = (
            <div
              key={`h${di}`}
              className="sticky top-0 z-20 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={mode === "edit" ? () => toggleDay?.(di) : undefined}
                className={`w-full leading-tight ${
                  mode === "edit" ? "cursor-pointer hover:text-brand-600" : "cursor-default"
                }`}
              >
                <div className="text-[10px] font-medium uppercase text-slate-400">{lbl.dow}</div>
                <div className="text-sm font-bold">{lbl.day}</div>
                <div className="text-[10px] text-slate-400">{lbl.month}</div>
              </button>
            </div>
          );
          return header;
        })}

        {/* randuri */}
        {grid.timeStarts.map((tstart, ti) => {
          const cells = [];
          // eticheta ora
          cells.push(
            <div
              key={`t${ti}`}
              className="sticky left-0 z-10 flex items-start justify-end border-r border-slate-200 bg-white pr-1.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={mode === "edit" ? () => toggleTimeRow?.(ti) : undefined}
                className={`-mt-1.5 text-[10px] tabular-nums text-slate-400 ${
                  mode === "edit" ? "cursor-pointer hover:text-brand-600" : "cursor-default"
                }`}
              >
                {ti % showEvery === 0 ? minutesToLabel(tstart) : ""}
              </button>
            </div>
          );
          for (let di = 0; di < nDays; di++) {
            const idx = di * grid.slotsPerDay + ti;
            const hourStart = ti % showEvery === 0;
            if (mode === "edit") {
              const on = selected?.has(idx);
              cells.push(
                <div
                  key={idx}
                  data-idx={idx}
                  onPointerDown={(e) => onCellPointerDown?.(idx, e)}
                  onPointerEnter={() => onCellPointerEnter?.(idx)}
                  onClick={() => onCellClick?.(idx)}
                  style={{ touchAction: "manipulation" }}
                  className={`h-7 cursor-pointer border-b border-l border-slate-100 transition-colors dark:border-slate-800 ${
                    hourStart ? "border-t-slate-200 dark:border-t-slate-700" : ""
                  } ${
                    on
                      ? "bg-emerald-400 hover:bg-emerald-500 dark:bg-emerald-500"
                      : "bg-slate-50 hover:bg-emerald-100 dark:bg-slate-950 dark:hover:bg-emerald-900"
                  }`}
                />
              );
            } else {
              const c = counts?.[idx] ?? 0;
              const t = total ?? 0;
              const ratio = t > 0 ? c / t : 0;
              const isActive = activeCell === idx;
              cells.push(
                <div
                  key={idx}
                  onClick={() => onCellClick?.(idx)}
                  title={`${c}/${t} liberi`}
                  className={`h-7 cursor-pointer border-b border-l border-slate-100 dark:border-slate-800 ${
                    isActive ? "ring-2 ring-inset ring-brand-500" : ""
                  }`}
                  style={{ backgroundColor: heatColor(ratio, c === t && t > 0) }}
                />
              );
            }
          }
          return cells;
        })}
      </div>
    </div>
  );
}

/* ---------- Adauga in calendar (iPhone / Android) ---------- */

function icsDateTime(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${date.replace(/-/g, "")}T${String(h).padStart(2, "0")}${String(m).padStart(
    2,
    "0"
  )}00`;
}

function googleCalUrl(title: string, date: string, startMin: number, endMin: number): string {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {}
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${icsDateTime(date, startMin)}/${icsDateTime(date, endMin)}`,
  });
  if (tz) params.set("ctz", tz);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function AddToCalendar({
  code,
  title,
  date,
  startMin,
  endMin,
}: {
  code: string;
  title: string;
  date: string;
  startMin: number;
  endMin: number;
}) {
  const icsUrl = `/api/events/${code}/ics?date=${date}&start=${startMin}&end=${endMin}`;
  const gUrl = googleCalUrl(title, date, startMin, endMin);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={icsUrl}
        className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        📅 Adaugă în calendar
      </a>
      <a
        href={gUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        Google Calendar
      </a>
    </div>
  );
}

// Culoare heatmap: de la gri (nimeni) la verde intens (toti).
function heatColor(ratio: number, all: boolean): string {
  if (ratio <= 0) return "rgba(148,163,184,0.12)";
  if (all) return "rgb(16,185,129)"; // emerald-500, toti liberi
  // interpolare verde cu opacitate crescatoare
  const alpha = 0.18 + ratio * 0.62;
  return `rgba(16,185,129,${alpha.toFixed(3)})`;
}
