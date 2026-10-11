// End-to-End-Test der Strava-Anbindung gegen scripts/strava-mock.mjs. BASE, SESSION_TOKEN setzen.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const out = [];
const ok = (c, m) => out.push(`${c ? 'PASS' : 'FAIL'} ${m}`);
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'] });
await ctx.addCookies([{ name: 'tl_session', value: process.env.SESSION_TOKEN, url: BASE }]);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
try {
  await p.goto(BASE + '/mehr');
  await p.waitForSelector('.strava-card a:has-text("Mit Strava verbinden")');
  ok(true, 'Strava eingerichtet, Knopf „Mit Strava verbinden“ sichtbar');
  await p.click('.strava-card a:has-text("Mit Strava verbinden")');
  await p.waitForURL(/\/mehr/);
  await p.waitForSelector('.strava-card .okmsg');
  ok((await p.textContent('.strava-card .okmsg')).includes('verbunden'), 'OAuth-Ablauf: ' + (await p.textContent('.strava-card .okmsg')));
  await p.waitForSelector('.strava-card :text("Läufe ·")');
  const card = (await p.textContent('.strava-card')).replace(/\s+/g, ' ');
  ok(card.includes('2 Läufe') && card.includes('15 km') && card.includes('Test Läufer'), 'Import: nur Läufe, Rad ignoriert – ' + card.slice(0, 120));

  await p.goto(BASE + '/tag/2030-01-02');
  await p.waitForSelector('.run-card');
  const rc = (await p.textContent('.run-card')).replace(/\s+/g, ' ');
  ok(rc.includes('5,00 km') && rc.includes('25:00') && rc.includes('5:00 /km'), 'Tagesansicht zeigt Lauf: ' + rc);

  await p.goto(BASE + '/verlauf');
  await p.click('.seg button:has-text("Kalender")');
  await p.waitForSelector('.cal-day');
  for (let i = 0; i < 60 && !(await p.textContent('.cal-head b')).includes('Januar 2030'); i++) await p.click('button[aria-label="Nächster Monat"]');
  const marks = await p.$$eval('.cal-day:not(.out) .cal-run', (e) => e.length);
  const runCards = await p.$$eval('.run-card', (e) => e.length);
  ok(marks === 2 && runCards === 2, `Kalender Januar 2030: ${marks} Lauf-Markierungen, ${runCards} Lauf-Karten · ${(await p.textContent('.cal-head')).replace(/\s+/g, ' ')}`);

  await p.click('.seg button:has-text("Auswertung")');
  await p.click('.seg.full button:has-text("Jahr")');
  for (let i = 0; i < 6 && (await p.textContent('.cal-head b')) !== '2030'; i++) await p.click('button[aria-label="Nächster Zeitraum"]');
  const stats = (await p.$$eval('.stats', (s) => s.map((x) => x.textContent.replace(/\s+/g, ' ')))).join(' | ');
  ok(stats.includes('15,0') && stats.includes('5:20 /km') && stats.includes('2 Läufe'), 'Auswertung 2030: ' + stats);
  const laufBars = await p.$$eval('.bars path[fill="var(--c-run)"]', (e) => e.length);
  ok(laufBars === 1, `Balkendiagramm: ${laufBars} Lauf-Balken (Q1)`);

  await p.goto(BASE + '/mehr');
  await p.waitForSelector('.strava-card button:has-text("Jetzt abgleichen")');
  await p.click('.strava-card button:has-text("Jetzt abgleichen")');
  await p.waitForSelector('.strava-card .okmsg');
  ok(true, 'Manueller Abgleich: ' + (await p.textContent('.strava-card .okmsg')));
  await p.click('.strava-card button:has-text("Strava trennen")');
  await p.waitForSelector('.strava-card a:has-text("Mit Strava verbinden")');
  ok(true, 'Trennen funktioniert');
} catch (e) {
  ok(false, 'Abbruch: ' + e.message.split('\n')[0]);
}
ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(out.join('\n'));
await b.close();
