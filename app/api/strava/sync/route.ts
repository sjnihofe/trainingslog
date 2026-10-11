import { bad, json } from '@/lib/http';
import { syncRuns } from '@/lib/strava';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { full } = await req.json().catch(() => ({}));
  try {
    return json(await syncRuns(Boolean(full)));
  } catch (e: any) {
    return bad(e.message ?? 'Synchronisierung fehlgeschlagen', 502);
  }
}
