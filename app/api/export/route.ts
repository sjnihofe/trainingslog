import { sql } from '@/lib/db';
import { currentUid, unauthorized } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const rows = (await sql`
    select w.date::text as date, c.name as category, ex.name, s.set_no, s.reps, s.weight, s.bodyweight, w.note
    from workouts w
    left join entries en on en.workout_id = w.id
    left join exercises ex on ex.id = en.exercise_id
    left join categories c on c.id = ex.category_id
    left join sets s on s.entry_id = en.id
    where w.user_id = ${uid}
    order by w.date, en.id, s.set_no`) as any[];
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['Datum;Kategorie;Übung;Satz;Wdh;Gewicht (kg);Körpergewicht;Notiz'];
  for (const r of rows) {
    lines.push([r.date, r.category, r.name, r.set_no, r.reps, r.weight === null ? '' : String(r.weight).replace('.', ','), r.bodyweight ? 'ja' : '', r.note].map(esc).join(';'));
  }
  return new Response('﻿' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="trainingslog-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
