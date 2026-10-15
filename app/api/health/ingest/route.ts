import { sql } from '@/lib/db';
import { fill, parseDate, samples, summary, uidFromToken } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Antwort als Klartext – der Kurzbefehl zeigt sie direkt als Mitteilung an
const text = (msg: string, status = 200) => new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
const HOUR = 3600_000;

/**
 * Empfängt Daten vom iPhone-Kurzbefehl (Authorization: Bearer tl_…).
 * event "start": Training beginnt · "end": Training endet (+ optional Samples) · "data": nur Samples nachliefern.
 * Samples: hr_values/hr_dates, kcal_values/kcal_dates – Listen oder zeilengetrennter Text.
 */
export async function POST(req: Request) {
  const uid = await uidFromToken(req);
  if (!uid) return text('Ungültiger Schlüssel – bitte in der App unter „Mehr“ einen neuen Schlüssel erzeugen.', 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return text('Ungültige Daten (JSON erwartet).', 400);

  const event = String(body.event ?? 'end').toLowerCase();
  const at = (parseDate(body.time) ?? new Date()).getTime();
  const type = typeof body.type === 'string' ? body.type.slice(0, 60) : null;
  const hr = samples(body.hr_values ?? body.hr, body.hr_dates);
  const kcal = samples(body.kcal_values ?? body.kcal, body.kcal_dates);

  if (event === 'start') {
    // offene, nie beendete Trainings älter als 8 h verwerfen
    await sql`delete from health_workouts where user_id = ${uid} and end_time is null and start_time < now() - interval '8 hours'`;
    await sql`insert into health_workouts (user_id, start_time, workout_type) values (${uid}, ${new Date(at).toISOString()}, ${type})
      on conflict (user_id, start_time) do nothing`;
    return text('Training gestartet – Puls und Kalorien kommen nach dem Ende.');
  }

  if (event === 'end') {
    const open = (await sql`select id, extract(epoch from start_time) * 1000 as s from health_workouts
      where user_id = ${uid} and end_time is null and start_time between ${new Date(at - 8 * HOUR).toISOString()} and ${new Date(at).toISOString()}
      order by start_time desc limit 1`) as any[];
    let id: number, start: number;
    if (open.length) {
      id = open[0].id; start = Number(open[0].s);
    } else {
      // Kein Start gemeldet: Beginn aus den Pulsdaten schätzen, sonst 60 Minuten
      const ts = hr.map((x) => x.t).filter((t): t is number => t !== null && t <= at && t >= at - 4 * HOUR).sort((a, b) => a - b);
      start = ts.length ? ts[0] : at - HOUR;
      const r = (await sql`insert into health_workouts (user_id, start_time, start_estimated, workout_type) values (${uid}, ${new Date(start).toISOString()}, true, ${type})
        on conflict (user_id, start_time) do update set start_estimated = true returning id`) as any[];
      id = r[0].id;
    }
    const duration = Math.max(0, Math.round((at - start) / 1000));
    await sql`update health_workouts set end_time = ${new Date(at).toISOString()}, duration_s = ${duration}, workout_type = coalesce(${type}, workout_type), updated_at = now() where id = ${id}`;
    const got = await fill(id, start, at, hr, kcal);
    const row = ((await sql`select duration_s, active_kcal::float, avg_hr::float, max_hr::float from health_workouts where id = ${id}`) as any[])[0];
    return text(got
      ? `Gespeichert: ${summary(row)}`
      : `Training gespeichert (${Math.round(duration / 60)} min). Puls/Kalorien fehlen noch – iPhone entsperren und „Trainingswerte senden“ ausführen.`);
  }

  if (event === 'data') {
    const rows = (await sql`select id, extract(epoch from start_time) * 1000 as s, extract(epoch from end_time) * 1000 as e from health_workouts
      where user_id = ${uid} and end_time is not null and end_time > now() - interval '48 hours' order by start_time`) as any[];
    const dated = [...hr, ...kcal].filter((x) => x.t !== null);
    if (!dated.length) return text('Keine Gesundheitsdaten mit Zeitstempel erhalten – ist das iPhone entsperrt?', 400);
    let n = 0;
    for (const r of rows) {
      const s = Number(r.s), e = Number(r.e);
      const covers = dated.some((x) => x.t! >= s && x.t! <= e);
      if (covers && (await fill(r.id, s, e, hr.filter((x) => x.t !== null), kcal.filter((x) => x.t !== null)))) n++;
    }
    return text(n ? `${n} ${n === 1 ? 'Training' : 'Trainings'} mit Puls/Kalorien ergänzt.` : 'Kein passendes Training in den letzten 48 Stunden gefunden.');
  }

  return text('Unbekanntes Ereignis – erlaubt sind start, end, data.', 400);
}
