import { sql } from '@/lib/db';
import { currentUid, json, unauthorized } from '@/lib/http';
import { getAccessToken, STRAVA_OAUTH } from '@/lib/strava';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const { deleteRuns } = await req.json().catch(() => ({}));
  try {
    const token = await getAccessToken(uid);
    if (token) await fetch(`${STRAVA_OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* lokal trotzdem trennen */ }
  await sql`delete from strava_auth where user_id = ${uid}`;
  if (deleteRuns) await sql`delete from runs where user_id = ${uid}`;
  return json({ ok: true });
}
