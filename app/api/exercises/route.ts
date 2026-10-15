import { sql } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';
import { ownCategory } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = await sql`
    select ex.id, ex.name, ex.category_id, c.name as category, c.color, ex.archived, ex.favorite,
      count(en.id)::int as uses, max(w.date)::text as last_date
    from exercises ex
    join categories c on c.id = ex.category_id
    left join entries en on en.exercise_id = ex.id
    left join workouts w on w.id = en.workout_id
    where ex.user_id = ${uid}
    group by ex.id, c.id
    order by c.position, ex.favorite desc, count(en.id) desc, ex.name`;
  return json(rows);
}

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const n = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  if (!n) return bad('Name fehlt');
  const cat = await ownCategory(uid, body?.categoryId);
  if (!cat) return bad('Ungültige Kategorie');
  const existing = (await sql`select ex.id, ex.name, ex.category_id, c.name as category, c.color, ex.archived, ex.favorite
    from exercises ex join categories c on c.id = ex.category_id where ex.user_id = ${uid} and lower(ex.name) = lower(${n})`) as any[];
  if (existing.length) {
    await sql`update exercises set archived = false where id = ${existing[0].id}`;
    return json({ ...existing[0], archived: false, uses: 0, last_date: null });
  }
  const rows = (await sql`with e as (insert into exercises (user_id, name, category_id) values (${uid}, ${n}, ${cat}) returning *)
    select e.id, e.name, e.category_id, c.name as category, c.color, e.archived, e.favorite from e join categories c on c.id = e.category_id`) as any[];
  return json({ ...rows[0], uses: 0, last_date: null });
}
