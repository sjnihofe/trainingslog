import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { bad, withSession } from '@/lib/http';
import { normEmail, seedExercises, validEmail } from '@/lib/users';
import { seedCategories } from '@/lib/categories';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normEmail(body?.email);
  const password = body?.password;
  if (!validEmail(email)) return bad('Bitte eine gültige E-Mail-Adresse eingeben');
  if (typeof password !== 'string' || password.length < 8) return bad('Passwort muss mindestens 8 Zeichen haben');
  const exists = (await sql`select 1 from users where lower(email) = ${email}`) as any[];
  if (exists.length) {
    await new Promise((r) => setTimeout(r, 600));
    return bad('Für diese E-Mail gibt es bereits ein Konto – bitte anmelden', 409);
  }
  const rows = (await sql`insert into users (email, password_hash) values (${email}, ${hashPassword(password)}) returning id`) as any[];
  const uid = rows[0].id as number;
  await seedCategories(uid);
  await seedExercises(uid);
  return withSession(NextResponse.json({ ok: true }), uid);
}
