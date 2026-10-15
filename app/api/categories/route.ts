import { sql } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';
import { CATEGORY_COLORS, cleanName, validColor } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = await sql`select c.id, c.name, c.color, c.position, count(e.id)::int as exercises
    from categories c left join exercises e on e.category_id = c.id
    where c.user_id = ${uid} group by c.id order by c.position, c.id`;
  return json(rows);
}

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const name = cleanName(body?.name);
  if (!name) return bad('Name fehlt');
  const count = ((await sql`select count(*)::int as n from categories where user_id = ${uid}`) as any[])[0].n;
  if (count >= 30) return bad('Maximal 30 Kategorien');
  const color = validColor(body?.color) ? body.color : CATEGORY_COLORS[count % CATEGORY_COLORS.length];
  try {
    const rows = (await sql`insert into categories (user_id, name, color, position)
      values (${uid}, ${name}, ${color}, (select coalesce(max(position), 0) + 1 from categories where user_id = ${uid}))
      returning id, name, color, position`) as any[];
    return json({ ...rows[0], exercises: 0 });
  } catch {
    return bad('Diese Kategorie gibt es schon', 409);
  }
}
