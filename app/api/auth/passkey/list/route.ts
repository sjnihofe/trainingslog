import { sql } from '@/lib/db';
import { bad, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql`select id, device_name, created_at::text, last_used::text from passkeys order by created_at`;
  return json(rows);
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string') return bad('id fehlt');
  await sql`delete from passkeys where id = ${id}`;
  return json({ ok: true });
}
