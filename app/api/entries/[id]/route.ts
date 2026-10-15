import { sql, normalizeSets } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

async function owns(uid: number, id: number) {
  const r = (await sql`select 1 from entries en join workouts w on w.id = en.workout_id where en.id = ${id} and w.user_id = ${uid}`) as any[];
  return r.length > 0;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  if (!(await owns(uid, id))) return bad('Eintrag nicht gefunden', 404);
  const body = await req.json().catch(() => ({}));
  const sets = normalizeSets(body?.sets);
  if (!sets.length) return bad('Mindestens ein Satz nötig');
  let ex: number | null = Number.isInteger(body?.exerciseId) ? body.exerciseId : null;
  if (ex !== null) {
    const ok = (await sql`select 1 from exercises where id = ${ex} and user_id = ${uid}`) as any[];
    if (!ok.length) ex = null;
  }
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
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  if (!(await owns(uid, id))) return bad('Eintrag nicht gefunden', 404);
  await sql`
    with d as (delete from entries where id = ${id} returning workout_id)
    delete from workouts w using d
    where w.id = d.workout_id and w.user_id = ${uid} and coalesce(w.note, '') = ''
      and not exists (select 1 from entries x where x.workout_id = w.id and x.id <> ${id})`;
  return json({ ok: true });
}
