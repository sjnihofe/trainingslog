import { sql } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { bad, json } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof next !== 'string' || next.length < 8) return bad('Neues Passwort muss mindestens 8 Zeichen haben');
  const rows = (await sql`select value from app_settings where key = 'password_hash'`) as any[];
  if (!rows.length || typeof current !== 'string' || !verifyPassword(current, rows[0].value)) return bad('Aktuelles Passwort ist falsch', 401);
  const h = hashPassword(next);
  await sql`update app_settings set value = ${h} where key = 'password_hash'`;
  return json({ ok: true });
}
