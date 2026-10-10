import { sql } from '@/lib/db';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql`
    select w.date::text as date, w.note,
      coalesce(json_agg(json_build_object(
        'name', ex.name, 'category', ex.category,
        'sets', coalesce((select json_agg(json_build_object('reps', s.reps, 'weight', s.weight, 'bodyweight', s.bodyweight) order by s.set_no)
                          from sets s where s.entry_id = en.id), '[]'::json)
      ) order by en.id) filter (where en.id is not null), '[]'::json) as entries
    from workouts w
    left join entries en on en.workout_id = w.id
    left join exercises ex on ex.id = en.exercise_id
    group by w.id
    order by w.date desc`;
  return json(rows);
}
