// Apple-Watch-Daten über iOS-Kurzbefehle: Parsen der Samples und Zuordnung zum Trainingszeitraum.
import { createHash, randomBytes } from 'crypto';
import { sql } from './db';

export const TZ = 'Europe/Berlin';
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newToken = () => 'tl_' + randomBytes(24).toString('base64url');

export async function uidFromToken(req: Request): Promise<number | null> {
  const h = req.headers.get('authorization') ?? '';
  const t = h.replace(/^Bearer\s+/i, '').trim();
  if (!t.startsWith('tl_')) return null;
  const rows = (await sql`update api_tokens set last_used = now() where token_hash = ${hashToken(t)} returning user_id`) as any[];
  return rows[0]?.user_id ?? null;
}

// --- Parsing ---------------------------------------------------------------
export function parseNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function tzOffsetMs(utcMs: number, tz = TZ) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(utcMs)).reduce<Record<string, number>>((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: Number(p.value) } : a), {});
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMs;
}
function localToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - tzOffsetMs(guess);
  return guess - tzOffsetMs(first);
}

/** ISO 8601 (mit/ohne Zeitzone), "15.10.2026, 19:40(:12)", "15.10.26 19:40", Unix-Sekunden/-Millisekunden. Ohne Zone = Europe/Berlin. */
export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000);
  const s = String(v).trim();
  if (/^\d{9,13}$/.test(s)) return parseDate(Number(s));
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    if (m[7]) return new Date(s.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return new Date(localToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0)));
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s*(?:um\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(localToUtc(y, +m[2], +m[1], +m[4], +m[5], +(m[6] ?? 0)));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const toList = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) : v === null || v === undefined ? [] : [v]);

export type Sample = { t: number | null; v: number };
export function samples(values: unknown, dates: unknown): Sample[] {
  const vs = toList(values), ds = toList(dates);
  const out: Sample[] = [];
  vs.forEach((x, i) => {
    const v = parseNum(x);
    if (v === null) return;
    const d = ds.length === vs.length ? parseDate(ds[i]) : null;
    out.push({ t: d ? d.getTime() : null, v });
  });
  return out;
}

// --- Auswertung je Training ----------------------------------------------------
export function metrics(start: number, end: number, hr: Sample[], kcal: Sample[]) {
  const inHr = hr.filter((s) => (s.t === null ? true : s.t >= start - 30_000 && s.t <= end + 60_000)).map((s) => s.v).filter((v) => v > 25 && v < 250);
  const inKcal = kcal.filter((s) => (s.t === null ? true : s.t >= start - 30_000 && s.t <= end + 30_000)).map((s) => s.v).filter((v) => v >= 0 && v < 500);
  return {
    hrCount: inHr.length,
    avgHr: inHr.length ? Math.round((inHr.reduce((a, b) => a + b, 0) / inHr.length) * 10) / 10 : null,
    maxHr: inHr.length ? Math.max(...inHr) : null,
    kcal: inKcal.length ? Math.round(inKcal.reduce((a, b) => a + b, 0) * 10) / 10 : null,
  };
}

export async function fill(id: number, start: number, end: number, hr: Sample[], kcal: Sample[]) {
  const m = metrics(start, end, hr, kcal);
  if (!m.hrCount && m.kcal === null) return false;
  await sql`update health_workouts set avg_hr = ${m.avgHr}, max_hr = ${m.maxHr}, hr_count = ${m.hrCount},
    active_kcal = coalesce(${m.kcal}::numeric, active_kcal), updated_at = now() where id = ${id}`;
  return true;
}

export function summary(h: { duration_s: number | null; active_kcal: number | null; avg_hr: number | null; max_hr: number | null }) {
  const parts: string[] = [];
  if (h.duration_s) parts.push(`${Math.round(h.duration_s / 60)} min`);
  if (h.active_kcal !== null) parts.push(`${Math.round(Number(h.active_kcal))} kcal`);
  if (h.avg_hr !== null) parts.push(`Ø ${Math.round(Number(h.avg_hr))}${h.max_hr !== null ? ` / max ${Math.round(Number(h.max_hr))}` : ''} bpm`);
  return parts.join(' · ');
}
