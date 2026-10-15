import { sql } from '@/lib/db';
import { json, bad } from '@/lib/http';
import { syncRuns, stravaConfigured } from '@/lib/strava';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Täglicher Abgleich aller verbundenen Konten durch Vercel Cron ("Authorization: Bearer $CRON_SECRET")
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return bad('Nicht erlaubt', 401);
  if (!stravaConfigured()) return json({ skipped: 'nicht eingerichtet' });
  const users = (await sql`select user_id from strava_auth order by last_sync nulls first`) as any[];
  const result: Record<string, unknown> = {};
  for (const u of users) {
    try { result[u.user_id] = await syncRuns(u.user_id, false); } catch (e: any) { result[u.user_id] = { error: e.message }; }
  }
  return json(result);
}
