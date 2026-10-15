import { sql } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const { current, next } = await req.json().catch(() => ({}));
  if (typeof next !== 'string' || next.length < 8) return bad('Neues Passwort muss mindestens 8 Zeichen haben');
  const rows = (await sql`select password_hash from users where id = ${uid}`) as any[];
  if (!rows.length || typeof current !== 'string' || !verifyPassword(current, rows[0].password_hash)) return bad('Aktuelles Passwort ist falsch', 401);
  await sql`update users set password_hash = ${hashPassword(next)} where id = ${uid}`;
  return json({ ok: true });
}
