import { buildGrid, type GridSpec } from "@/lib/slots";
import type { CommonInterval } from "@/lib/types";

// Calculeaza suprapunerile de disponibilitate.
//
// Primeste specificatia grilei, numarul total de participanti si lista de
// seturi de sloturi libere (cate un number[] per participant). Returneaza:
//   - counts: cati participanti sunt liberi la fiecare index de slot
//   - common: intervalele continue in care TOTI sunt liberi

export function computeResults(
  spec: GridSpec,
  meetingMinutes: number,
  availabilities: number[][]
): { counts: number[]; common: CommonInterval[] } {
  const grid = buildGrid(spec);
  const counts = new Array<number>(grid.totalSlots).fill(0);

  for (const slots of availabilities) {
    for (const idx of slots) {
      if (idx >= 0 && idx < grid.totalSlots) counts[idx]++;
    }
  }

  const total = availabilities.length;
  const common: CommonInterval[] = [];

  if (total === 0) return { counts, common };

  // Parcurge fiecare zi separat (nu unim peste granita dintre zile).
  for (let dayIndex = 0; dayIndex < grid.days.length; dayIndex++) {
    let runStart = -1; // timeIndex de start al secventei curente comune
    for (let t = 0; t <= grid.slotsPerDay; t++) {
      const slotIndex = dayIndex * grid.slotsPerDay + t;
      const allFree = t < grid.slotsPerDay && counts[slotIndex] === total;
      if (allFree && runStart === -1) {
        runStart = t;
      } else if (!allFree && runStart !== -1) {
        // Inchide secventa [runStart, t)
        const startMin = grid.timeStarts[runStart];
        const endMin = grid.timeStarts[t - 1] + grid.slotMinutes;
        const durationMin = endMin - startMin;
        common.push({
          date: grid.days[dayIndex],
          startMin,
          endMin,
          durationMin,
          fitsMeeting: durationMin >= meetingMinutes,
        });
        runStart = -1;
      }
    }
  }

  return { counts, common };
}
