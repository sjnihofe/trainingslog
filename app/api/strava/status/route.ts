import { sql } from '@/lib/db';
import { json } from '@/lib/http';
import { stravaConfigured } from '@/lib/strava';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = (await sql`select athlete_name, last_sync::text, connected_at::text, scope from strava_auth where id = 1`) as any[];
  const n = (await sql`select count(*)::int as n, coalesce(sum(distance_m), 0)::float as m from runs`) as any[];
  return json({ configured: stravaConfigured(), connected: a.length > 0, ...(a[0] ?? {}), runs: n[0].n, totalKm: Math.round(n[0].m / 100) / 10 });
}
