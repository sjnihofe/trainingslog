import { neon } from '@neondatabase/serverless';

// Fallback-URL nur damit der Build ohne Env-Variable nicht abbricht.
export const sql = neon(process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost/db');

export type SetRow = { set_no?: number; reps: number | null; weight: number | null; bodyweight: boolean };

export function normalizeSets(input: unknown): SetRow[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s: any, i: number) => {
      const bodyweight = Boolean(s?.bodyweight);
      const reps = s?.reps === null || s?.reps === '' || s?.reps === undefined ? null : Math.round(Number(s.reps));
      const w = s?.weight === null || s?.weight === '' || s?.weight === undefined ? null : Number(String(s.weight).replace(',', '.'));
      return {
        set_no: i + 1,
        reps: reps !== null && Number.isFinite(reps) && reps >= 0 ? reps : null,
        weight: bodyweight ? null : w !== null && Number.isFinite(w) ? w : null,
        bodyweight,
      };
    })
    .filter((s) => s.reps !== null || s.weight !== null || s.bodyweight);
}

export const CATEGORIES = ['Beine', 'Rücken', 'Brust', 'Schulter', 'Sonstiges'] as const;

export function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}
