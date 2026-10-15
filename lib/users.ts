import { sql } from './db';

export const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '');
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;

// Startübungen für neue Konten (je Kategorie die gängigsten)
const STARTER: [string, string, boolean][] = [
  ['Kniebeuge', 'Beine', true], ['Beinpresse', 'Beine', false], ['Ausfallschritte', 'Beine', false],
  ['Klimmzüge', 'Rücken', true], ['Latzug', 'Rücken', false], ['Rudern Maschine', 'Rücken', false],
  ['Bankdrücken', 'Brust', true], ['Bankdrücken KH', 'Brust', false], ['Dips', 'Brust', false],
  ['Schulterdrücken KH', 'Schulter', true], ['Seitheben', 'Schulter', false],
  ['Hip Thrust', 'Sonstiges', true], ['Bizeps KH', 'Sonstiges', false], ['Plank', 'Sonstiges', false],
];

export async function seedExercises(uid: number) {
  // Kategorien müssen vorher angelegt sein (seedCategories) – Zuordnung über den Namen
  await sql`insert into exercises (user_id, name, category_id, favorite)
    select ${uid}, t.n, c.id, t.f from unnest(${STARTER.map((s) => s[0])}::text[], ${STARTER.map((s) => s[1])}::text[], ${STARTER.map((s) => s[2])}::bool[]) as t(n, c, f)
    join categories c on c.user_id = ${uid} and c.name = t.c
    on conflict do nothing`;
}
