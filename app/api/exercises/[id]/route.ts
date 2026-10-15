import { sql } from '@/lib/db';
import { ownCategory } from '@/lib/categories';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 80) : null;
  const category = body?.categoryId !== undefined ? await ownCategory(uid, body.categoryId) : null;
  const archived = typeof body?.archived === 'boolean' ? body.archived : null;
  const favorite = typeof body?.favorite === 'boolean' ? body.favorite : null;
  if (name !== null && !name) return bad('Name darf nicht leer sein');
  try {
    await sql`update exercises set
      name = coalesce(${name}, name),
      category_id = coalesce(${category}::int, category_id),
      archived = coalesce(${archived}::bool, archived),
      favorite = coalesce(${favorite}::bool, favorite)
      where id = ${id} and user_id = ${uid}`;
  } catch {
    return bad('Diesen Namen gibt es schon', 409);
  }
  return json({ ok: true });
}
