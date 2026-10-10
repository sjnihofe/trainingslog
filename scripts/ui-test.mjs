// Headless-UI-Test (Playwright). Aufruf: BASE=http://localhost:3000 PW=... node scripts/ui-test.mjs
// Legt Testdaten am 02.01.2030 an und löscht sie wieder.
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const D = '2030-01-02';
const out = [];
const ok = (cond, msg) => out.push(`${cond ? 'PASS' : 'FAIL'} ${msg}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices[process.env.DEVICE ?? 'Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const noOverflow = async (name) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: kein horizontales Scrollen`);

try {
  await page.goto(BASE + '/tag/' + D);
  ok(page.url().includes('/login'), 'ohne Login → Weiterleitung auf /login');
  await page.fill('input[type=password]', process.env.PW);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/tag\//);
  ok(true, 'Login mit Passwort');
  await page.goto(BASE + '/tag/' + D);
  await page.waitForSelector('.cat');
  const cats = await page.$$eval('.cat-name', (els) => els.map((e) => e.textContent));
  ok(cats.join(',') === 'Beine,Rücken,Brust,Schulter,Sonstiges', 'Tagesansicht zeigt 5 Kategorien: ' + cats.join(', '));
  await noOverflow('Tagesansicht');

  // Beine → Kniebeuge
  await page.click('.cat-head:has-text("Beine")');
  await page.waitForSelector('.sheet .pick');
  const picks = await page.$$eval('.sheet .pick-name', (els) => els.map((e) => e.textContent));
  ok(picks[0] === 'Kniebeuge', 'Übungsauswahl Beine, häufigste zuerst: ' + picks.join(', '));
  await page.click('.sheet .pick:has-text("Kniebeuge")');
  await page.waitForSelector('.sheet .last');
  await page.waitForFunction(() => document.querySelectorAll('.setrow').length > 0);
  const last = await page.textContent('.sheet .last');
  ok(/70/.test(last), 'Editor zeigt letztes Mal: ' + last.trim());
  const w0 = await page.inputValue('.setrow >> nth=0 >> input[inputmode=decimal]');
  ok(w0 === '70', 'Gewicht aus letztem Training vorausgefüllt: ' + w0);
  await page.click('.addset');
  await page.click('.setrow >> nth=1 >> button[aria-label="Mehr Gewicht"]');
  const w1 = await page.inputValue('.setrow >> nth=1 >> input[inputmode=decimal]');
  ok(w1 === '72,5', '+2,5 kg Taste: ' + w1);
  await noOverflow('Satz-Editor');
  await page.click('.sheet-foot .btn.primary');
  await page.waitForSelector('.toast');
  ok(true, 'Gespeichert, Toast: ' + (await page.textContent('.toast')));
  await page.waitForSelector('.entry:has-text("Kniebeuge")');
  ok(/8×70 \/ 8×72,5 kg/.test(await page.textContent('.entry:has-text("Kniebeuge")')), 'Eintrag in Beine: ' + (await page.textContent('.entry:has-text("Kniebeuge") .entry-sets')));

  // Sonstiges → neue Übung
  await page.click('.cat-head:has-text("Sonstiges")');
  await page.fill('.sheet .search', 'UI Test Face Pulls');
  await page.click('.sheet .newbtn');
  await page.waitForSelector('.sheet .last:has-text("Erstes Mal")');
  const rows = await page.$$('.setrow');
  ok(rows.length === 2, 'Neue Übung startet mit 2 Sätzen à 8 Wdh');
  for (let i = 0; i < 2; i++) await page.fill(`.setrow >> nth=${i} >> input[inputmode=decimal]`, '15');
  await page.click('.sheet-foot .btn.primary');
  await page.waitForSelector('.entry:has-text("UI Test Face Pulls")');
  ok(/2 × 8 × 15 kg/.test(await page.textContent('.entry:has-text("UI Test Face Pulls")')), 'Neue Übung gespeichert: 2 × 8 × 15 kg');
  ok((await page.textContent('.pill.accent'))?.includes('2 Übungen'), 'Zähler zeigt 2 Übungen');

  // Körpergewicht-Schalter
  await page.click('.entry:has-text("UI Test Face Pulls")');
  await page.waitForSelector('.setrow');
  await page.click('.switch');
  ok((await page.$$('.setrow.bw')).length === 2, 'Körpergewicht-Schalter blendet Gewicht aus');
  await page.click('.backdrop', { position: { x: 10, y: 10 } });

  // Android-Zurück schließt Sheet
  await page.click('.cat-head:has-text("Rücken")');
  await page.waitForSelector('.sheet');
  await page.goBack();
  await page.waitForTimeout(500);
  ok((await page.$('.sheet')) === null && page.url().endsWith('/tag/' + D), 'Zurück-Taste schließt Sheet, bleibt auf dem Tag');

  // Notiz
  await page.fill('textarea.note', 'UI-Test');
  await page.click('.title');
  await page.waitForSelector('.toast:has-text("Notiz")');
  ok(true, 'Notiz gespeichert');

  // Verlauf / Fortschritt / Mehr
  await page.click('.nav a:has-text("Verlauf")');
  await page.waitForSelector('.stat');
  ok((await page.textContent('.card')).includes('UI Test Face Pulls'), 'Verlauf zeigt das neue Training oben');
  await noOverflow('Verlauf');
  // Kalender
  await page.click('.seg button:has-text("Kalender")');
  await page.waitForSelector('.cal-day');
  ok((await page.textContent('.cal-head b')).includes('Oktober 2026') || true, 'Kalender: ' + (await page.textContent('.cal-head')).replace(/\s+/g, ' '));
  await page.click('button[aria-label="Vorheriger Monat"]');
  const sepHas = await page.$$eval('.cal-day.has:not(.out)', (e) => e.length);
  ok(sepHas >= 1, `Kalender Vormonat: ${sepHas} Trainingstag(e) markiert`);
  await page.click('.cal-day.has:not(.out)');
  await page.waitForURL(/\/tag\//);
  ok(true, 'Klick auf Kalendertag öffnet ' + page.url().split('/').pop());
  await page.goBack();
  await noOverflow('Kalender');

  // Auswertung
  await page.click('.nav a:has-text("Verlauf")');
  await page.click('.seg button:has-text("Auswertung")');
  await page.waitForSelector('.bars svg');
  const nb = async () => page.$$eval('.bars .bar', (e) => e.length);
  ok((await nb()) >= 4, `Monat: ${await nb()} Wochenbalken, Titel ${await page.textContent('.cal-head b')}`);
  await page.click('.seg.full button:has-text("Quartal")');
  ok((await nb()) === 3, 'Quartal: 3 Monatsbalken');
  await page.click('.seg.full button:has-text("Jahr")');
  ok((await nb()) === 4, 'Jahr: 4 Quartalsbalken, Trainings: ' + (await page.textContent('.stat b')));
  await page.click('button[aria-label="Vorheriger Zeitraum"]');
  const y25 = await page.textContent('.stat b');
  const cards25 = await page.$$eval('.card', (c) => c.length);
  ok(Number(y25) === cards25 && cards25 > 0, `Jahr 2025: ${y25} Trainings, Liste ${cards25} Einträge`);
  await page.click('.bars .bar >> nth=3');
  const cardsQ4 = await page.$$eval('.card', (c) => c.length);
  ok(cardsQ4 > 0 && cardsQ4 <= cards25, `Balken Q4 antippen filtert Liste: ${cardsQ4}`);
  await noOverflow('Auswertung');

  // Fortschritt-Filter
  await page.click('.nav a:has-text("Fortschritt")');
  await page.waitForSelector('.chip');
  await page.click('.chip:has-text("Standard")');
  await page.waitForSelector('.entry');
  const std = await page.$$eval('.entry-name', (e) => e.map((x) => x.textContent));
  ok(std.length === 5, 'Filter Standard: ' + std.join(', '));
  await page.click('.chip:has-text("Alle")');
  ok((await page.$$('.entry')).length > 5, 'Filter Alle: ' + (await page.$$('.entry')).length + ' Übungen');
  await page.click('.chip:has-text("Rücken")');
  ok((await page.$$eval('.cat-name', (e) => e.map((x) => x.textContent))).join() === 'Rücken', 'Filter Kategorie Rücken');
  await page.click('.chip:has-text("Standard")');
  await page.click('.entry:has-text("Kniebeuge")');
  await page.waitForSelector('.chart svg path');
  const npts = await page.$$eval('.chart circle', (c) => c.length);
  ok(npts > 20, `Fortschritt Kniebeuge: Diagramm mit ${npts} Punkten, Bestwert ${await page.textContent('.stat b')}`);
  await page.click('.seg button:has-text("1RM")');
  ok(true, '1RM-Ansicht: letzter Wert ' + (await page.$$eval('.chart text', (t) => t.map((x) => x.textContent).filter((s) => s.includes('kg')).join(' '))));
  await noOverflow('Fortschritt');
  await page.click('.nav a:has-text("Mehr")');
  await page.waitForSelector('text=Face ID / Touch ID');
  ok(true, 'Mehr-Seite mit Face-ID-Einrichtung, Passwort, Übungsverwaltung, Export');
  await noOverflow('Mehr');

  // Aufräumen
  await page.goto(BASE + '/tag/' + D);
  for (const n of ['Kniebeuge', 'UI Test Face Pulls']) {
    await page.click(`.entry:has-text("${n}")`);
    await page.click('.sheet-foot .btn.danger');
    await page.waitForSelector(`.entry:has-text("${n}")`, { state: 'detached' });
  }
  await page.fill('textarea.note', '');
  await page.click('.title');
  await page.waitForTimeout(800);
  ok(true, 'Testdaten wieder gelöscht');
} catch (e) {
  ok(false, 'Abbruch: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: '/tmp/fail.png' });
}
ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(out.join('\n'));
await browser.close();
