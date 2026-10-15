import { sql, isISODate, normalizeSets } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export async function POST(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { date, exerciseId } = body ?? {};
  const sets = normalizeSets(body?.sets);
  if (!isISODate(date)) return bad('Ungültiges Datum');
  if (!Number.isInteger(exerciseId)) return bad('Übung fehlt');
  if (!sets.length) return bad('Mindestens ein Satz nötig');
  const own = (await sql`select 1 from exercises where id = ${exerciseId} and user_id = ${uid}`) as any[];
  if (!own.length) return bad('Übung nicht gefunden', 404);
  const rows = (await sql`
    with w as (
      insert into workouts (user_id, date) values (${uid}, ${date})
      on conflict (user_id, date) do update set date = excluded.date
      returning id
    ), e as (
      insert into entries (workout_id, exercise_id) select id, ${exerciseId} from w returning id
    )
    insert into sets (entry_id, set_no, reps, weight, bodyweight)
    select e.id, t.set_no, t.reps, t.weight, t.bodyweight
    from e, unnest(${sets.map((s) => s.set_no)}::int[], ${sets.map((s) => s.reps)}::int[],
                   ${sets.map((s) => s.weight)}::numeric[], ${sets.map((s) => s.bodyweight)}::bool[])
         as t(set_no, reps, weight, bodyweight)
    returning entry_id`) as any[];
  return json({ id: rows[0]?.entry_id });
}
