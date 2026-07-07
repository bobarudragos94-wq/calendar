// Tipuri partajate intre client si server.

export interface EventRow {
  id: string;
  code: string;
  title: string;
  /** YYYY-MM-DD, inclusiv */
  start_date: string;
  /** YYYY-MM-DD, inclusiv */
  end_date: string;
  /** minute de la miezul noptii pentru inceputul ferestrei zilnice afisate */
  day_start_min: number;
  /** minute de la miezul noptii pentru finalul ferestrei zilnice afisate */
  day_end_min: number;
  /** granularitatea unui slot in minute (ex. 30) */
  slot_minutes: number;
  /** durata minima a meeting-ului in minute */
  meeting_minutes: number;
  owner_token: string;
  created_at: number;
  /** ora finala aleasa de organizator (optional) */
  chosen_date: string | null;
  chosen_start_min: number | null;
  chosen_end_min: number | null;
}

/** Ora finala a meeting-ului, aleasa de organizator. */
export interface ChosenSlot {
  date: string;
  startMin: number;
  endMin: number;
}

/** Reprezentarea publica a unui event (fara owner_token). */
export interface EventPublic {
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  dayStartMin: number;
  dayEndMin: number;
  slotMinutes: number;
  meetingMinutes: number;
  participants: { id: string; name: string }[];
  /** ora finala aleasa de organizator, daca exista */
  chosen: ChosenSlot | null;
}

export interface ParticipantRow {
  id: string;
  event_id: string;
  name: string;
  token: string;
  /** JSON: number[] cu indicii sloturilor libere */
  slots: string;
  created_at: number;
}

/** Un interval continuu in care toti participantii sunt liberi. */
export interface CommonInterval {
  date: string; // YYYY-MM-DD
  startMin: number; // minute de la miezul noptii
  endMin: number;
  durationMin: number;
  /** true daca durata >= durata ceruta a meeting-ului */
  fitsMeeting: boolean;
}

export interface ResultsResponse {
  event: EventPublic;
  total: number;
  /** count-ul de participanti liberi pentru fiecare index de slot */
  counts: number[];
  common: CommonInterval[];
  /** disponibilitatea fiecarui participant (pentru a arata cine e liber cand) */
  availability: { name: string; slots: number[] }[];
}
