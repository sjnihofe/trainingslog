import { sql } from '@/lib/db';
import { currentUid, json, unauthorized } from '@/lib/http';
import { syncIfStale } from '@/lib/strava';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  await syncIfStale(uid, 10);
  const rows = await sql`select strava_id::text as id, start_date::text as date, name, sport_type, distance_m::float as distance_m,
      moving_time_s, elevation_gain_m::float as elevation_gain_m, avg_hr::float as avg_hr
    from runs where user_id = ${uid} order by start_time desc`;
  return json(rows);
}
