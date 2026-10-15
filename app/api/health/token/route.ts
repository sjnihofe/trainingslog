import { sql } from '@/lib/db';
import { currentUid, json, unauthorized } from '@/lib/http';
import { hashToken, newToken } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const t = (await sql`select created_at::text, last_used::text from api_tokens where user_id = ${uid}`) as any[];
  const h = (await sql`select max(updated_at)::text as last_data, count(*)::int as n from health_workouts where user_id = ${uid}`) as any[];
  return json({ exists: t.length > 0, ...(t[0] ?? {}), last_data: h[0].last_data, workouts: h[0].n });
}

// Neuer Schlüssel (ersetzt den alten). Klartext wird nur dieses eine Mal zurückgegeben.
export async function POST() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const token = newToken();
  await sql`insert into api_tokens (user_id, token_hash) values (${uid}, ${hashToken(token)})
    on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used = null`;
  return json({ token });
}

export async function DELETE() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  await sql`delete from api_tokens where user_id = ${uid}`;
  return json({ ok: true });
}
