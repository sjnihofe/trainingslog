import { sql } from '@/lib/db';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = (await sql`select count(*)::int as n from passkeys`) as any[];
  return json({ hasPasskeys: rows[0].n > 0 });
}
