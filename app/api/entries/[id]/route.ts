import { sql, normalizeSets } from '@/lib/db';
import { bad, json } from '@/lib/http';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  const body = await req.json().catch(() => ({}));
  const sets = normalizeSets(body?.sets);
  if (!sets.length) return bad('Mindestens ein Satz nötig');
  const ex = Number.isInteger(body?.exerciseId) ? body.exerciseId : null;
  await sql.transaction([
    sql`delete from sets where entry_id = ${id}`,
    sql`insert into sets (entry_id, set_no, reps, weight, bodyweight)
        select ${id}, t.set_no, t.reps, t.weight, t.bodyweight
        from unnest(${sets.map((s) => s.set_no)}::int[], ${sets.map((s) => s.reps)}::int[],
                    ${sets.map((s) => s.weight)}::numeric[], ${sets.map((s) => s.bodyweight)}::bool[])
             as t(set_no, reps, weight, bodyweight)`,
    sql`update entries set exercise_id = coalesce(${ex}::int, exercise_id) where id = ${id}`,
  ]);
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  // Eintrag löschen; leeren Trainingstag ohne Notiz gleich mit entfernen
  await sql`
    with d as (delete from entries where id = ${id} returning workout_id)
    delete from workouts w using d
    where w.id = d.workout_id and coalesce(w.note, '') = ''
      and not exists (select 1 from entries x where x.workout_id = w.id and x.id <> ${id})`;
  return json({ ok: true });
}
