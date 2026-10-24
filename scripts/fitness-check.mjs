// Prüft die Fitness-Berechnung mit echten Daten eines Kontos (nur lesend). BASE + SESSION_TOKEN; Aufruf mit: npx tsx scripts/fitness-check.mjs
import { fitnessTimeline, fitnessTrend, seriesOf, toPercent, isBodyweight } from '../lib/progress.ts';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const r = await fetch(BASE + '/api/progress', { headers: { cookie: 'tl_session=' + process.env.SESSION_TOKEN } });
const d = await r.json();
const today = new Date().toISOString().slice(0, 10);
const tl = fitnessTimeline(d.exercises, d.activity, today);
const tr = fitnessTrend(tl);
console.log('Übungen mit Daten:', d.exercises.filter((e) => e.sessions.length).length, '· Trainingstage:', d.activity.length);
console.log('Fitness-Verlauf (monatlich):', tl.filter((_, i) => i % 4 === 0 || i === tl.length - 1).map((p) => `${p.date}: ${p.value} (Kraft ${p.strength}%, Akt ${p.activity}%, ${p.exercises} Üb.)`).join('\n  '));
console.log('Trend:', JSON.stringify({ aktuell: tr?.current.value, vor4W: tr?.ref?.value, delta: tr?.delta, state: tr?.state }));
for (const name of ['Kniebeuge', 'Bankdrücken', 'Klimmzüge']) {
  const ex = d.exercises.find((e) => e.name === name);
  if (!ex) continue;
  const s = seriesOf(ex, 'top');
  console.log(`${name} (${isBodyweight(ex) ? 'Wdh' : 'kg'}): erste ${s[0]?.v}, letzte ${s.at(-1)?.v}, % letzte ${toPercent(s).at(-1)?.v}`);
}
