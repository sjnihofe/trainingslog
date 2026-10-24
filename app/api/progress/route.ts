import { sql } from '@/lib/db';
import { currentUid, json, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Alle Daten für die Fortschritts-Seite in einem Abruf (nur lesend)
export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const [exercises, categories, activity] = await Promise.all([
    sql`select ex.id, ex.name, ex.category_id, ex.favorite, ex.archived,
          coalesce(json_agg(json_build_object('date', w.date::text, 'sets',
            coalesce((select json_agg(json_build_object('reps', s.reps, 'weight', s.weight, 'bodyweight', s.bodyweight) order by s.set_no)
                      from sets s where s.entry_id = en.id), '[]'::json)) order by w.date, en.id)
            filter (where en.id is not null), '[]'::json) as sessions
        from exercises ex
        left join entries en on en.exercise_id = ex.id
        left join workouts w on w.id = en.workout_id
        where ex.user_id = ${uid}
        group by ex.id
        order by ex.id`,
    sql`select id, name, color, position from categories where user_id = ${uid} order by position, id`,
    // Trainingstage (Kraft, Läufe, Apple Watch) für die Aktivitäts-Komponente des Fitnessniveaus
    sql`select distinct d::text as date from (
          select date as d from workouts where user_id = ${uid} and exists (select 1 from entries e where e.workout_id = workouts.id)
          union select start_date from runs where user_id = ${uid}
          union select (start_time at time zone 'Europe/Berlin')::date from health_workouts where user_id = ${uid} and end_time is not null
        ) t order by 1`,
  ]);
  return json({ exercises, categories, activity: (activity as any[]).map((r) => r.date) });
}
