import { sql, CATEGORIES } from '@/lib/db';
import { bad, json } from '@/lib/http';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 80) : null;
  const category = CATEGORIES.includes(body?.category) ? body.category : null;
  const archived = typeof body?.archived === 'boolean' ? body.archived : null;
  if (name !== null && !name) return bad('Name darf nicht leer sein');
  try {
    await sql`update exercises set
      name = coalesce(${name}, name),
      category = coalesce(${category}, category),
      archived = coalesce(${archived}::bool, archived)
      where id = ${id}`;
  } catch {
    return bad('Diesen Namen gibt es schon', 409);
  }
  return json({ ok: true });
}
