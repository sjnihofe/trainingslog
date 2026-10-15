import { sql } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = await sql`select id, device_name, created_at::text, last_used::text from passkeys where user_id = ${uid} order by created_at`;
  return json(rows);
}

export async function DELETE(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string') return bad('id fehlt');
  await sql`delete from passkeys where id = ${id} and user_id = ${uid}`;
  return json({ ok: true });
}
