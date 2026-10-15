import { sql, CATEGORIES } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = await sql`
    select ex.id, ex.name, ex.category, ex.archived, ex.favorite,
      count(en.id)::int as uses, max(w.date)::text as last_date
    from exercises ex
    left join entries en on en.exercise_id = ex.id
    left join workouts w on w.id = en.workout_id
    where ex.user_id = ${uid}
    group by ex.id
    order by ex.category, ex.favorite desc, count(en.id) desc, ex.name`;
  return json(rows);
}

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const { name, category } = await req.json().catch(() => ({}));
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  if (!n) return bad('Name fehlt');
  if (!CATEGORIES.includes(category)) return bad('Ungültige Kategorie');
  const existing = (await sql`select id, name, category, archived, favorite from exercises where user_id = ${uid} and lower(name) = lower(${n})`) as any[];
  if (existing.length) {
    await sql`update exercises set archived = false where id = ${existing[0].id}`;
    return json({ ...existing[0], archived: false, uses: 0, last_date: null });
  }
  const rows = (await sql`insert into exercises (user_id, name, category) values (${uid}, ${n}, ${category}) returning id, name, category, archived, favorite`) as any[];
  return json({ ...rows[0], uses: 0, last_date: null });
}
