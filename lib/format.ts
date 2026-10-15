export type WSet = { reps: number | null; weight: number | null; bodyweight: boolean };


export function num(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n);
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

function one(s: WSet) {
  const r = s.reps ?? '?';
  if (s.bodyweight || s.weight === null) return `${r}`;
  return `${r}×${num(s.weight)}`;
}

// "2 × 8 × 70 kg" bei identischen Sätzen, sonst "8×70 / 6×65 kg"
export function fmtSets(sets: WSet[]) {
  if (!sets?.length) return '';
  const bw = sets.every((s) => s.bodyweight || s.weight === null);
  const same = sets.every((s) => s.reps === sets[0].reps && s.weight === sets[0].weight && s.bodyweight === sets[0].bodyweight);
  if (same && sets.length > 1) {
    return bw ? `${sets.length} × ${sets[0].reps ?? '?'} Wdh` : `${sets.length} × ${sets[0].reps ?? '?'} × ${num(sets[0].weight)} kg`;
  }
  return sets.map(one).join(' / ') + (bw ? ' Wdh' : ' kg');
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('de-DE', { ...opts, timeZone: 'UTC' });
}

export function fmtShort(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400_000);
}

export async function api<T = any>(url: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body === undefined ? undefined : typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
  });
  if (res.status === 401 && !url.startsWith('/api/auth')) {
    window.location.href = '/login';
    throw new Error('Nicht angemeldet');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Fehler ${res.status}`);
  return data as T;
}

// ---- Datumshelfer für Kalender & Auswertung (alles in UTC gerechnet, ISO-Strings YYYY-MM-DD) ----
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const parseISO = (s: string) => new Date(s + 'T00:00:00Z');
export function addMonths(s: string, n: number) {
  const d = parseISO(s.slice(0, 7) + '-01');
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
}
export function monthStart(s: string) { return s.slice(0, 7) + '-01'; }
export function monthEnd(s: string) { const d = parseISO(addMonths(s, 1)); d.setUTCDate(0); return iso(d); }
export function mondayOf(s: string) { const d = parseISO(s); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return iso(d); }
export function isoWeek(s: string) {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}
export const monthName = (s: string, opts: Intl.DateTimeFormatOptions = { month: 'long' }) => parseISO(s).toLocaleDateString('de-DE', { ...opts, timeZone: 'UTC' });

// ---- Läufe (Strava) ----
export type Run = { id: string; date: string; name: string | null; sport_type: string; distance_m: number; moving_time_s: number; elevation_gain_m: number | null; avg_hr: number | null };

export const fmtKm = (m: number) => (m / 1000).toFixed(m >= 100000 ? 0 : m >= 10000 ? 1 : 2).replace('.', ',') + ' km';
export function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
export function fmtPace(movingS: number, distanceM: number) {
  if (!distanceM) return '–';
  const p = movingS / (distanceM / 1000);
  let m = Math.floor(p / 60), s = Math.round(p % 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')} /km`;
}
export const RUN_LABEL: Record<string, string> = { Run: 'Lauf', TrailRun: 'Traillauf', VirtualRun: 'Laufband' };

// ---- Apple Watch (über Kurzbefehle) ----
export type HealthW = { id: number; date?: string; start_time: string; end_time: string | null; start_estimated: boolean; workout_type: string | null; duration_s: number | null; active_kcal: number | null; avg_hr: number | null; max_hr: number | null; hr_count: number };
export function fmtHealth(h: HealthW) {
  const parts: string[] = [];
  if (h.duration_s) parts.push(`${Math.round(h.duration_s / 60)} min`);
  if (h.active_kcal !== null) parts.push(`${Math.round(h.active_kcal)} kcal`);
  if (h.avg_hr !== null) parts.push(`Ø ${Math.round(h.avg_hr)}${h.max_hr !== null ? `/${Math.round(h.max_hr)}` : ''} bpm`);
  return parts.join(' · ');
}
