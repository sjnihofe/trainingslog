import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { bad, withSession } from '@/lib/http';
import { normEmail } from '@/lib/users';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normEmail(body?.email);
  const password = body?.password;
  if (!email || typeof password !== 'string' || !password) return bad('E-Mail und Passwort eingeben');
  const rows = (await sql`select id, password_hash from users where lower(email) = ${email}`) as any[];
  if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
    await new Promise((r) => setTimeout(r, 800));
    return bad('E-Mail oder Passwort falsch', 401);
  }
  return withSession(NextResponse.json({ ok: true }), rows[0].id);
}
