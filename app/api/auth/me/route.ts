import { sql } from '@/lib/db';
import { currentUid, json, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = (await sql`select email, created_at::text from users where id = ${uid}`) as any[];
  if (!rows.length) return unauthorized();
  return json(rows[0]);
}
