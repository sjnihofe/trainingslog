import { sql } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) return bad('ids fehlen');
  await sql`update categories c set position = t.pos
    from unnest(${ids}::int[]) with ordinality as t(id, pos)
    where c.id = t.id and c.user_id = ${uid}`;
  return json({ ok: true });
}
