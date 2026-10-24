// Berechnungen für die Fortschritts-Seite: Kennwerte je Einheit, Prozent-Basis und Fitnessniveau.
import type { WSet } from './format';

export type PSession = { date: string; sets: WSet[] };
export type PExercise = { id: number; name: string; category_id: number; favorite: boolean; archived: boolean; sessions: PSession[] };
export type Metric = 'top' | 'e1rm' | 'volume';
export type Point = { date: string; t: number; v: number };

const DAY = 86400_000;
export const tOf = (d: string) => Date.parse(d + 'T00:00:00Z');

/** Übung ohne Zusatzgewicht (nur Körpergewicht) → es zählen Wiederholungen statt Kilo. */
export function isBodyweight(ex: PExercise) {
  const sets = ex.sessions.flatMap((s) => s.sets);
  return sets.length > 0 && sets.every((s) => s.bodyweight || !s.weight);
}

/** Kennwert einer Einheit – gleiche Logik wie in der bisherigen Detailansicht. */
export function sessionValue(sets: WSet[], metric: Metric, bw: boolean): number {
  if (!sets.length) return 0;
  if (bw) {
    const reps = sets.map((s) => s.reps ?? 0);
    return metric === 'volume' ? reps.reduce((a, b) => a + b, 0) : Math.max(...reps);
  }
  const w = (s: WSet) => (s.bodyweight ? 0 : Number(s.weight ?? 0));
  if (metric === 'top') return Math.max(...sets.map(w));
  if (metric === 'e1rm') return Math.max(...sets.map((s) => w(s) * (1 + (s.reps ?? 1) / 30)));
  return sets.reduce((a, s) => a + w(s) * (s.reps ?? 0), 0);
}

export function seriesOf(ex: PExercise, metric: Metric): Point[] {
  const bw = isBodyweight(ex);
  return ex.sessions
    .map((s) => ({ date: s.date, t: tOf(s.date), v: Math.round(sessionValue(s.sets, metric, bw) * 10) / 10 }))
    .filter((p) => p.v > 0);
}

/** Prozent: allererste getrackte Einheit der Übung = 100 %. */
export function toPercent(points: Point[]): Point[] {
  const base = points[0]?.v;
  if (!base) return [];
  return points.map((p) => ({ ...p, v: Math.round((p.v / base) * 1000) / 10 }));
}

// ---------------------------------------------------------------------------
// Fitnessniveau
//
// Kraft-Index: Für jede Übung wird die Leistung der letzten Einheit (max. 6 Wochen alt)
//   mit ihrer allerersten Einheit verglichen (geschätztes 1RM; bei Körpergewicht: Wiederholungen).
//   Der Mittelwert über alle aktuell trainierten Übungen – gewichtet nach Häufigkeit in den
//   letzten 12 Wochen – ergibt den Kraft-Index (Start = 100).
// Aktivität: Trainingstage (Kraft, Laufen, Apple Watch) der letzten 4 Wochen; Ziel 2 pro Woche.
// Fitnessniveau = Kraft-Index × (0,7 + 0,3 × Aktivität), Aktivität auf 100 % begrenzt.
//   → Wer pausiert, verliert spürbar (bis zu 30 %), auch wenn die letzten Werte gut waren.
// ---------------------------------------------------------------------------
export const FIT = { recentDays: 42, weightDays: 84, activityDays: 28, targetPerWeek: 2 };

export type FitPoint = { date: string; t: number; value: number; strength: number; activity: number; exercises: number };

export function fitnessAt(exs: PExercise[], activity: string[], endDate: string): FitPoint | null {
  const end = tOf(endDate);
  let sw = 0, sr = 0, n = 0;
  for (const ex of exs) {
    const pts = seriesOf(ex, 'e1rm');
    if (pts.length < 2 || pts[0].t > end) continue;
    const base = pts[0].v;
    const upto = pts.filter((p) => p.t <= end);
    const last = upto[upto.length - 1];
    if (!last || last === pts[0] || end - last.t > FIT.recentDays * DAY) continue;
    const w = Math.max(1, upto.filter((p) => end - p.t <= FIT.weightDays * DAY).length);
    const r = Math.min(3, Math.max(0.3, last.v / base));
    sw += w; sr += w * r; n++;
  }
  if (!n) return null;
  const strength = (sr / sw) * 100;
  const days = activity.filter((d) => { const t = tOf(d); return t <= end && end - t < FIT.activityDays * DAY; }).length;
  const act = days / ((FIT.activityDays / 7) * FIT.targetPerWeek);
  const value = strength * (0.7 + 0.3 * Math.min(1, act));
  return { date: endDate, t: end, value: Math.round(value * 10) / 10, strength: Math.round(strength * 10) / 10, activity: Math.round(act * 100), exercises: n };
}

/** Wöchentlicher Verlauf (jeweils Sonntag bzw. heute) seit dem ersten Training. */
export function fitnessTimeline(exs: PExercise[], activity: string[], today: string): FitPoint[] {
  const first = activity[0];
  if (!first) return [];
  const out: FitPoint[] = [];
  const t0 = tOf(first), tEnd = tOf(today);
  const d = new Date(t0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7)); // nächster Sonntag
  for (let t = d.getTime(); t < tEnd; t += 7 * DAY) {
    const p = fitnessAt(exs, activity, new Date(t).toISOString().slice(0, 10));
    if (p) out.push(p);
  }
  const now = fitnessAt(exs, activity, today);
  if (now) out.push(now);
  return out;
}

export function fitnessTrend(timeline: FitPoint[]) {
  const cur = timeline[timeline.length - 1];
  if (!cur) return null;
  const ref = [...timeline].reverse().find((p) => cur.t - p.t >= 28 * DAY) ?? null;
  const delta = ref ? Math.round((cur.value - ref.value) * 10) / 10 : null;
  const state = delta === null ? 'neu' : delta >= 2 ? 'steigend' : delta <= -2 ? 'fallend' : 'stabil';
  return { current: cur, ref, delta, state } as const;
}
