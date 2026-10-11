import { sql } from '@/lib/db';
import { json } from '@/lib/http';
import { getAccessToken, STRAVA_OAUTH } from '@/lib/strava';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { deleteRuns } = await req.json().catch(() => ({}));
  try {
    const token = await getAccessToken();
    if (token) await fetch(`${STRAVA_OAUTH}/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch { /* lokal trotzdem trennen */ }
  await sql`delete from strava_auth where id = 1`;
  if (deleteRuns) await sql`delete from runs`;
  return json({ ok: true });
}
