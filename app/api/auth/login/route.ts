import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { bad, withSession } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || !password) return bad('Passwort fehlt');
  const rows = (await sql`select value from app_settings where key = 'password_hash'`) as any[];
  if (!rows.length || !verifyPassword(password, rows[0].value)) {
    await new Promise((r) => setTimeout(r, 800));
    return bad('Falsches Passwort', 401);
  }
  return withSession(NextResponse.json({ ok: true }));
}
