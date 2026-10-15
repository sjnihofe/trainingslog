import { sql, isISODate } from '@/lib/db';
import { bad, currentUid, json, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';

// Verlauf einer Übung, neueste zuerst. ?before=YYYY-MM-DD&limit=n
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return bad('Ungültige ID');
  const url = new URL(req.url);
  const beforeParam = url.searchParams.get('before');
  const before = beforeParam && isISODate(beforeParam) ? beforeParam : '9999-12-31';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 1000, 1), 1000);
  const ex = (await sql`select ex.id, ex.name, c.name as category, c.color, ex.archived, ex.favorite from exercises ex join categories c on c.id = ex.category_id where ex.id = ${id} and ex.user_id = ${uid}`) as any[];
  if (!ex.length) return bad('Übung nicht gefunden', 404);
  const sessions = await sql`
    select en.id, w.date::text as date,
      coalesce((select json_agg(json_build_object('reps', s.reps, 'weight', s.weight, 'bodyweight', s.bodyweight) order by s.set_no)
                from sets s where s.entry_id = en.id), '[]'::json) as sets
    from entries en join workouts w on w.id = en.workout_id
    where en.exercise_id = ${id} and w.user_id = ${uid} and w.date < ${before}
    order by w.date desc, en.id desc
    limit ${limit}`;
  return json({ exercise: ex[0], sessions });
}
