// Kategorien pro Konto (frei anlegbar). Standard-Set für neue Konten.
import { sql } from './db';

export const DEFAULT_CATEGORIES: [string, string][] = [
  ['Beine', '#ffb020'], ['Rücken', '#3fb8ff'], ['Brust', '#ff6fae'], ['Schulter', '#a98bff'], ['Sonstiges', '#3fd6a0'],
];

// Auswahlfarben (dunkler Hintergrund, gut unterscheidbar)
export const CATEGORY_COLORS = ['#ffb020', '#3fb8ff', '#ff6fae', '#a98bff', '#3fd6a0', '#ff7a1a', '#f2e14c', '#5ad1e8', '#ff5a5f', '#9bd65a', '#c9a27c', '#8d95a3'];

export const validColor = (c: unknown) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
export const cleanName = (n: unknown) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, 40) : '');

export async function seedCategories(uid: number) {
  await sql`insert into categories (user_id, name, color, position)
    select ${uid}, t.n, t.c, t.p from unnest(${DEFAULT_CATEGORIES.map((c) => c[0])}::text[], ${DEFAULT_CATEGORIES.map((c) => c[1])}::text[],
      ${DEFAULT_CATEGORIES.map((_, i) => i + 1)}::int[]) as t(n, c, p)
    on conflict do nothing`;
}

/** Kategorie-ID nur zurückgeben, wenn sie dem Nutzer gehört. */
export async function ownCategory(uid: number, id: unknown): Promise<number | null> {
  if (!Number.isInteger(id)) return null;
  const r = (await sql`select id from categories where id = ${id as number} and user_id = ${uid}`) as any[];
  return r.length ? r[0].id : null;
}
