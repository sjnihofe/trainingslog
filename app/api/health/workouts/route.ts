import { sql } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';
import { TZ } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = await sql`select id, (start_time at time zone ${TZ})::date::text as date, start_time::text, end_time::text, start_estimated,
      workout_type, duration_s, active_kcal::float as active_kcal, avg_hr::float as avg_hr, max_hr::float as max_hr, hr_count
    from health_workouts where user_id = ${uid} and end_time is not null order by start_time desc`;
  return json(rows);
}

export async function DELETE(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  await sql`delete from health_workouts where id = ${id} and user_id = ${uid}`;
  return json({ ok: true });
}
