// Matematica sloturilor de timp, folosita identic pe client si server.
//
// Un "slot" este o celula de {slot_minutes} minute intr-o zi din perioada.
// Sloturile sunt indexate liniar:
//   slotIndex = dayIndex * slotsPerDay + timeIndex
// unde timeIndex numara sloturile in interiorul ferestrei orare zilnice.

export interface GridSpec {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dayStartMin: number;
  dayEndMin: number;
  slotMinutes: number;
}

export interface Grid {
  days: string[]; // lista de date YYYY-MM-DD
  /** minutul de start pentru fiecare slot din interiorul unei zile */
  timeStarts: number[];
  slotsPerDay: number;
  totalSlots: number;
  slotMinutes: number;
}

/** Adauga n zile la o data YYYY-MM-DD, fara probleme de fus orar. */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Numarul de zile intre doua date (inclusiv ambele capete). */
export function daysBetween(startDate: string, endDate: string): number {
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = endDate.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((b - a) / 86400000) + 1;
}

export function buildGrid(spec: GridSpec): Grid {
  const nDays = Math.max(0, daysBetween(spec.startDate, spec.endDate));
  const days: string[] = [];
  for (let i = 0; i < nDays; i++) days.push(addDays(spec.startDate, i));

  const timeStarts: number[] = [];
  for (let t = spec.dayStartMin; t + spec.slotMinutes <= spec.dayEndMin; t += spec.slotMinutes) {
    timeStarts.push(t);
  }
  const slotsPerDay = timeStarts.length;
  return {
    days,
    timeStarts,
    slotsPerDay,
    totalSlots: days.length * slotsPerDay,
    slotMinutes: spec.slotMinutes,
  };
}

/** Formateaza minute-de-la-miezul-noptii ca HH:MM. */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const RO_DAYS = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
const RO_MONTHS = [
  "ian", "feb", "mar", "apr", "mai", "iun",
  "iul", "aug", "sep", "oct", "noi", "dec",
];

/** Eticheta scurta pentru o data, ex. "Mar 07 iul". */
export function formatDayLabel(dateStr: string): { dow: string; day: string; month: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    dow: RO_DAYS[dt.getUTCDay()],
    day: String(d).padStart(2, "0"),
    month: RO_MONTHS[m - 1],
  };
}

/** Data lunga pentru afisare, ex. "Marți, 7 iulie". */
export function formatDateLong(dateStr: string): string {
  const RO_DAYS_LONG = [
    "Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă",
  ];
  const RO_MONTHS_LONG = [
    "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
    "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
  ];
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${RO_DAYS_LONG[dt.getUTCDay()]}, ${d} ${RO_MONTHS_LONG[m - 1]}`;
}
