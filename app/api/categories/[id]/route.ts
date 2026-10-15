import { sql } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';
import { cleanName, ownCategory, validColor } from '@/lib/categories';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = await ownCategory(uid, Number((await params).id));
  if (!id) return bad('Kategorie nicht gefunden', 404);
  const body = await req.json().catch(() => ({}));
  const name = body?.name !== undefined ? cleanName(body.name) : null;
  if (name !== null && !name) return bad('Name darf nicht leer sein');
  const color = validColor(body?.color) ? body.color : null;
  try {
    await sql`update categories set name = coalesce(${name}, name), color = coalesce(${color}, color) where id = ${id}`;
  } catch {
    return bad('Diese Kategorie gibt es schon', 409);
  }
  return json({ ok: true });
}

// Löschen; vorhandene Übungen werden nach ?moveTo=<id> verschoben (Pflicht, wenn welche existieren)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = await ownCategory(uid, Number((await params).id));
  if (!id) return bad('Kategorie nicht gefunden', 404);
  const left = ((await sql`select count(*)::int as n from categories where user_id = ${uid}`) as any[])[0].n;
  if (left <= 1) return bad('Mindestens eine Kategorie muss bleiben');
  const used = ((await sql`select count(*)::int as n from exercises where category_id = ${id}`) as any[])[0].n;
  if (used > 0) {
    const moveTo = await ownCategory(uid, Number(new URL(req.url).searchParams.get('moveTo')));
    if (!moveTo || moveTo === id) return bad('Bitte eine Kategorie wählen, in die die Übungen verschoben werden', 409);
    await sql.transaction([
      sql`update exercises set category_id = ${moveTo} where category_id = ${id}`,
      sql`delete from categories where id = ${id}`,
    ]);
  } else {
    await sql`delete from categories where id = ${id}`;
  }
  return json({ ok: true });
}
