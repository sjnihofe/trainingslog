// End-to-End-Test Apple-Watch-Schnittstelle (simuliert den iPhone-Kurzbefehl). BASE setzen.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const out = []; const ok = (c, m) => out.push(`${c ? 'PASS' : 'FAIL'} ${m}`);
const user = { email: `test-watch-${Date.now().toString(36)}@example.com`, pw: 'TestPasswort-W1' };
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const api = (url, method = 'GET', body) => p.evaluate(async ([u, m, bd]) => { const r = await fetch(u, { method: m, headers: bd ? { 'Content-Type': 'application/json' } : {}, body: bd ? JSON.stringify(bd) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; }, [url, method, body]);
const MIN = 60_000, now = Date.now();
const iso = (t) => new Date(t).toISOString();
const berlin = (t) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(t));
let TOKEN = '';
const ingest = async (body, token = TOKEN) => {
  const r = await fetch(BASE + '/api/health/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
};
try {
  await p.goto(BASE + '/login');
  await p.click('.seg button:has-text("Registrieren")');
  await p.fill('input[type=email]', user.email);
  await p.fill('input[autocomplete=new-password] >> nth=0', user.pw);
  await p.fill('input[autocomplete=new-password] >> nth=1', user.pw);
  await p.click('button[type=submit]');
  await p.waitForURL(/\/tag\//);

  // Schlüssel über die Oberfläche erzeugen
  await p.goto(BASE + '/mehr');
  await p.click('.watch-card-settings button:has-text("Schlüssel erzeugen")');
  await p.waitForSelector('.token-box');
  TOKEN = (await p.textContent('.token-box')).trim();
  ok(/^tl_/.test(TOKEN), 'Schlüssel erzeugt und einmalig angezeigt');

  // 1) Normalfall: Start + Ende mit Samples (Text mit Zeilenumbrüchen, Komma-Dezimalen, ISO-Daten)
  const s1 = now - 100 * MIN, e1 = now - 50 * MIN;            // 50 Minuten
  const hrIn = [110, 130, 150, 165, 125];                      // Ø 136, max 165
  const hrT = hrIn.map((_, i) => s1 + (i + 1) * 8 * MIN);
  const kcalIn = ['80,5', '90,25', '70'];                      // = 240,75
  const kcalT = [s1 + 10 * MIN, s1 + 25 * MIN, s1 + 40 * MIN];
  let r = await ingest({ event: 'start', time: iso(s1), type: 'Krafttraining' });
  ok(r.status === 200 && r.text.includes('gestartet'), 'Start: ' + r.text);
  r = await ingest({
    event: 'end', time: iso(e1),
    hr_values: [95, ...hrIn].join('\n'), hr_dates: [iso(s1 - 30 * MIN), ...hrT.map(iso)].join('\n'),   // 1 Wert vor Beginn → ignoriert
    kcal_values: kcalIn.join('\n'), kcal_dates: kcalT.map(iso).join('\n'),
  });
  ok(r.text.includes('50 min') && r.text.includes('241 kcal') && r.text.includes('Ø 136') && r.text.includes('max 165'), 'Ende mit Daten: ' + r.text);

  // 2) iPhone gesperrt: Ende ohne Samples, später „data“ mit deutschem Datumsformat
  const s2 = now - 40 * MIN, e2 = now - 10 * MIN;
  await ingest({ event: 'start', time: iso(s2) });
  r = await ingest({ event: 'end', time: iso(e2), hr_values: '', kcal_values: '' });
  ok(r.text.includes('fehlen noch'), 'Gesperrtes iPhone: ' + r.text);
  r = await ingest({ event: 'data', hr_values: '100\n140\n120', hr_dates: [s2 + 5 * MIN, s2 + 15 * MIN, s2 + 25 * MIN].map(berlin).join('\n'), kcal_values: '50\n60', kcal_dates: [s2 + 10 * MIN, s2 + 20 * MIN].map(berlin).join('\n') });
  ok(r.text.includes('1 Training'), 'Nachliefern: ' + r.text);

  // 3) Ungültiger Schlüssel
  r = await ingest({ event: 'start' }, 'tl_falsch');
  ok(r.status === 401, 'Falscher Schlüssel abgelehnt (401)');

  // Anzeige
  const list = await api('/api/health/workouts');
  const w2 = list.body.find((h) => Math.abs(new Date(h.start_time).getTime() - s2) < 2000);
  ok(list.body.length === 2 && w2?.avg_hr === 120 && w2?.max_hr === 140 && w2?.active_kcal === 110, `Gespeichert: ${list.body.map((h) => `${h.duration_s / 60}min/${h.active_kcal}kcal/Ø${h.avg_hr}`).join(', ')}`);
  const today = list.body[0].date;
  await p.goto(BASE + '/tag/' + today);
  await p.waitForSelector('.watch-card');
  ok((await p.$$('.watch-card')).length === 2, 'Tagesansicht: 2 Apple-Watch-Karten · ' + (await p.textContent('.watch-card')).replace(/\s+/g, ' ').slice(0, 80));
  await p.goto(BASE + '/verlauf');
  await p.click('.seg button:has-text("Liste")');
  await p.waitForSelector('.health-line');
  ok((await p.$$('.health-line')).length === 2, 'Verlauf: Watch-Werte am Training · ' + (await p.textContent('.health-line')).replace(/\s+/g, ' '));
  await p.click('.seg button:has-text("Auswertung")');
  await p.waitForSelector('.stats-label:has-text("Apple Watch")');
  const tiles = (await p.$$eval('.stats', (s) => s.map((x) => x.textContent.replace(/\s+/g, ' ')))).join(' | ');
  ok(tiles.includes('351') && tiles.includes('kcal'), 'Auswertung: ' + tiles);
  await p.click('.seg button:has-text("Kalender")');
  ok((await p.$$('.cal-day.has.today')).length === 1, 'Kalender markiert den Tag');
} catch (e) { ok(false, 'Abbruch: ' + e.message.split('\n')[0]); }
ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(out.join('\n'));
console.log('TESTUSER=' + user.email);
await b.close();
