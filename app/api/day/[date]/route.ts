import { sql, isISODate } from '@/lib/db';
import { bad, json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) return bad('Ungültiges Datum');
  const w = (await sql`select id, note from workouts where date = ${date}`) as any[];
  const entries = await sql`
    select en.id, en.exercise_id, ex.name, ex.category,
      coalesce((select json_agg(json_build_object('reps', s.reps, 'weight', s.weight, 'bodyweight', s.bodyweight) order by s.set_no)
                from sets s where s.entry_id = en.id), '[]'::json) as sets
    from entries en
    join workouts w on w.id = en.workout_id
    join exercises ex on ex.id = en.exercise_id
    where w.date = ${date}
    order by en.id`;
  return json({ date, note: w[0]?.note ?? '', entries });
}

export async function PUT(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isISODate(date)) return bad('Ungültiges Datum');
  const { note } = await req.json().catch(() => ({}));
  const n = typeof note === 'string' ? note.trim().slice(0, 1000) : '';
  if (n) {
    await sql`insert into workouts (date, note) values (${date}, ${n}) on conflict (date) do update set note = excluded.note`;
  } else {
    await sql`update workouts set note = null where date = ${date}`;
    await sql`delete from workouts w where w.date = ${date} and not exists (select 1 from entries e where e.workout_id = w.id)`;
  }
  return json({ ok: true });
}
