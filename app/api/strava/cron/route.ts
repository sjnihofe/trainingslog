import { json, bad } from '@/lib/http';
import { syncRuns, stravaConfigured } from '@/lib/strava';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Täglicher Abgleich durch Vercel Cron (sendet "Authorization: Bearer $CRON_SECRET")
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return bad('Nicht erlaubt', 401);
  if (!stravaConfigured()) return json({ skipped: 'nicht eingerichtet' });
  try { return json(await syncRuns(false)); } catch (e: any) { return bad(e.message, 502); }
}
