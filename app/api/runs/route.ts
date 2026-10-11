import { sql } from '@/lib/db';
import { json } from '@/lib/http';
import { syncIfStale } from '@/lib/strava';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  await syncIfStale(10);
  const rows = await sql`select strava_id::text as id, start_date::text as date, name, sport_type, distance_m::float as distance_m,
      moving_time_s, elevation_gain_m::float as elevation_gain_m, avg_hr::float as avg_hr
    from runs order by start_time desc`;
  return json(rows);
}
