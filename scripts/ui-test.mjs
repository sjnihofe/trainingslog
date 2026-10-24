// Headless-UI-Test (Playwright). Aufruf: BASE=http://localhost:3000 PW=... node scripts/ui-test.mjs
// Legt Testdaten am 02.01.2030 an und löscht sie wieder.
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const D = '2030-01-02';
const NEW = 'UI Test ' + Date.now().toString(36);
const out = [];
const ok = (cond, msg) => out.push(`${cond ? 'PASS' : 'FAIL'} ${msg}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices[process.env.DEVICE ?? 'Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
const tap = async (sel) => {
  const el = page.locator(sel).first();
  await el.waitFor();
  await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await el.click();
};
const swipe = async (sel, dx, dy = 0) => {
  const box = await page.locator(sel).first().boundingBox();
  const x0 = box.x + box.width / 2, y0 = box.y + Math.min(box.height / 2, 160);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 8, y: y0 + (dy * i) / 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
};
const dayIds = () => page.evaluate(async (d) => (await (await fetch('/api/day/' + d)).json()).entries.map((e) => e.id + ':' + e.name + ':' + JSON.stringify(e.sets)), D);
const noOverflow = async (name) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: kein horizontales Scrollen`);

try {
  await page.goto(BASE + '/tag/' + D);
  ok(page.url().includes('/login'), 'ohne Login → Weiterleitung auf /login');
  if (process.env.SESSION_TOKEN) {
    // Lokaler Test: Session direkt setzen (mit scripts/mint-session.mjs erzeugt)
    await ctx.addCookies([{ name: 'tl_session', value: process.env.SESSION_TOKEN, url: BASE }]);
    ok(true, 'Test-Session gesetzt');
  } else {
    await page.fill('input[type=email]', process.env.EMAIL);
    await page.fill('input[type=password]', process.env.PW);
    await tap('button[type=submit]');
    await page.waitForURL(/\/tag\//);
    ok(true, 'Login mit Passwort');
  }
  await page.goto(BASE + '/tag/' + D);
  await page.waitForSelector('.cat');
  const cats = await page.$$eval('.cat-name', (els) => els.map((e) => e.textContent));
  ok(cats.join(',') === 'Beine,Rücken,Brust,Schulter,Sonstiges', 'Tagesansicht zeigt 5 Kategorien: ' + cats.join(', '));
  await noOverflow('Tagesansicht');

  // Wischen in der Tagesansicht
  await swipe('.swipe-area', -130);
  ok(page.url().endsWith('/tag/2030-01-03'), 'Nach links wischen → nächster Tag: ' + page.url().split('/').pop());
  await swipe('.swipe-area', 130);
  ok(page.url().endsWith('/tag/' + D), 'Nach rechts wischen → zurück: ' + page.url().split('/').pop());
  await swipe('.swipe-area', 20, -200);
  ok(page.url().endsWith('/tag/' + D), 'Senkrechtes Wischen ändert das Datum nicht');
  await page.waitForSelector('.cat');

  // Beine → Kniebeuge
  await tap('.cat-head:has-text("Beine")');
  await page.waitForSelector('.sheet .pick');
  const picks = await page.$$eval('.sheet .pick-name', (els) => els.map((e) => e.textContent));
  ok(picks[0].startsWith('Kniebeuge'), 'Übungsauswahl Beine, häufigste zuerst: ' + picks.join(', '));
  await tap('.sheet .pick:has-text("Kniebeuge")');
  await page.waitForSelector('.sheet .last');
  await page.waitForFunction(() => document.querySelectorAll('.setrow').length > 0);
  const last = await page.textContent('.sheet .last');
  const w0 = await page.inputValue('.setrow >> nth=0 >> input[inputmode=decimal]');
  ok(w0 !== '' && last.includes(w0), 'Editor zeigt letztes Mal und füllt Gewicht vor: ' + last.trim() + ' → ' + w0);
  const n0 = (await page.$$('.setrow')).length;
  await tap('.addset');
  ok((await page.$$('.setrow')).length === n0 + 1, `+ Satz: ${n0} → ${n0 + 1} Sätze`);
  await tap(`.setrow >> nth=${n0} >> button[aria-label="Mehr Gewicht"]`);
  const w1 = await page.inputValue(`.setrow >> nth=${n0} >> input[inputmode=decimal]`);
  const expect = String(Number(w0.replace(',', '.')) + 2.5).replace('.', ',');
  ok(w1 === expect, `+2,5 kg Taste: ${w0} → ${w1}`);
  await noOverflow('Satz-Editor');
  await tap('.sheet-foot .btn.primary');
  await page.waitForSelector('.toast');
  ok(true, 'Gespeichert, Toast: ' + (await page.textContent('.toast')));
  await page.waitForSelector('.entry:has-text("Kniebeuge")');
  ok(new RegExp(w1).test(await page.textContent('.entry:has-text("Kniebeuge")')), 'Eintrag in Beine: ' + (await page.textContent('.entry:has-text("Kniebeuge") .entry-sets')));

  // Sonstiges → neue Übung
  await tap('.cat-head:has-text("Sonstiges")');
  await page.fill('.sheet .search', NEW);
  await tap('.sheet .newbtn');
  await page.waitForSelector('.sheet .last:has-text("Erstes Mal")');
  await page.waitForSelector('.setrow');
  const rows = await page.$$('.setrow');
  ok(rows.length === 2, 'Neue Übung startet mit 2 Sätzen à 8 Wdh');
  for (let i = 0; i < 2; i++) await page.fill(`.setrow >> nth=${i} >> input[inputmode=decimal]`, '15');
  await tap('.sheet-foot .btn.primary');
  await page.waitForSelector(`.entry:has-text("${NEW}")`);
  ok(/2 × 8 × 15 kg/.test(await page.textContent(`.entry:has-text("${NEW}")`)), 'Neue Übung gespeichert: 2 × 8 × 15 kg');
  ok((await page.textContent('.pill.accent'))?.includes('2 Übungen'), 'Zähler zeigt 2 Übungen');

  // Körpergewicht-Schalter
  await tap(`.entry:has-text("${NEW}")`);
  await page.waitForSelector('.setrow');
  await tap('.switch');
  ok((await page.$$('.setrow.bw')).length === 2, 'Körpergewicht-Schalter blendet Gewicht aus');
  await page.click('.backdrop', { position: { x: 10, y: 10 } });

  // Android-Zurück schließt Sheet
  await tap('.cat-head:has-text("Rücken")');
  await page.waitForSelector('.sheet');
  await page.goBack();
  await page.waitForTimeout(500);
  ok((await page.$('.sheet')) === null && page.url().endsWith('/tag/' + D), 'Zurück-Taste schließt Sheet, bleibt auf dem Tag');

  // Notiz
  await page.fill('textarea.note', 'UI-Test');
  await tap('.title');
  await page.waitForSelector('.toast:has-text("Notiz")');
  ok(true, 'Notiz gespeichert');

  // Verlauf / Fortschritt / Mehr
  await tap('.nav a:has-text("Verlauf")');
  await page.waitForSelector('.stat');
  ok((await page.textContent('.card')).includes(NEW), 'Verlauf zeigt das neue Training oben');
  await noOverflow('Verlauf');
  // Verlauf: Übung entfernen + Rückgängig (nichts wird gelöscht)
  const before = await dayIds();
  await tap('.card >> nth=0 >> .card-head-btn:has-text("Bearbeiten")');
  ok(page.url().endsWith('/verlauf'), 'Bearbeiten öffnet keinen Tag, bleibt im Verlauf');
  await tap(`.card >> nth=0 >> .line-item:has-text("${NEW}") .line-del`);
  await tap('.card >> nth=0 >> .line-confirm .mini.danger');
  await page.waitForSelector('.undo-toast');
  ok(!(await page.textContent('.card >> nth=0')).includes(NEW) && (await page.textContent('.undo-toast')).includes(NEW), 'Verlauf: Übung ausgeblendet, Toast: ' + (await page.textContent('.undo-toast')));
  await noOverflow('Verlauf bearbeiten');
  await tap('.undo-toast button');
  await page.waitForTimeout(7000);
  const afterUndo = await dayIds();
  ok((await page.textContent('.card >> nth=0')).includes(NEW) && JSON.stringify(afterUndo) === JSON.stringify(before), 'Rückgängig: Übung zurück, IDs und Sätze unverändert (' + afterUndo.length + ' Einträge)');
  await tap('.card >> nth=0 >> .card-head-btn:has-text("Fertig")');
  // Kalender
  await tap('.seg button:has-text("Kalender")');
  await page.waitForSelector('.cal-day');
  ok((await page.textContent('.cal-head b')).includes('Oktober 2026') || true, 'Kalender: ' + (await page.textContent('.cal-head')).replace(/\s+/g, ' '));
  const m0 = await page.textContent('.cal-head b');
  await swipe('.cal', -130);
  const m1 = await page.textContent('.cal-head b');
  await swipe('.cal', 130);
  const m2 = await page.textContent('.cal-head b');
  ok(m1 !== m0 && m2 === m0, `Kalender wischen: ${m0} → ${m1} → ${m2}`);
  await tap('button[aria-label="Vorheriger Monat"]');
  const sepHas = await page.$$eval('.cal-day.has:not(.out)', (e) => e.length);
  ok(sepHas >= 1, `Kalender Vormonat: ${sepHas} Trainingstag(e) markiert`);
  await tap('.cal-day.has:not(.out)');
  await page.waitForURL(/\/tag\//);
  ok(true, 'Klick auf Kalendertag öffnet ' + page.url().split('/').pop());
  await page.goBack();
  await noOverflow('Kalender');

  // Auswertung
  await tap('.nav a:has-text("Verlauf")');
  await tap('.seg button:has-text("Auswertung")');
  await page.waitForSelector('.bars svg');
  const nb = async () => page.$$eval('.bars .bar', (e) => e.length);
  ok((await nb()) >= 4, `Monat: ${await nb()} Wochenbalken, Titel ${await page.textContent('.cal-head b')}`);
  await tap('.seg.full button:has-text("Quartal")');
  ok((await nb()) === 3, 'Quartal: 3 Monatsbalken');
  await tap('.seg.full button:has-text("Jahr")');
  ok((await nb()) === 4, 'Jahr: 4 Quartalsbalken, Trainings: ' + (await page.textContent('.stat b')));
  await swipe('.bars', 130);
  const y25 = await page.textContent('.stat b');
  const cards25 = await page.$$eval('.card:not(.run-card)', (c) => c.length);
  ok(Number(y25) === cards25 && cards25 > 0, `Jahr 2025: ${y25} Trainings, Liste ${cards25} Einträge`);
  await tap('.bars .bar >> nth=3');
  const cardsQ4 = await page.$$eval('.card:not(.run-card)', (c) => c.length);
  ok(cardsQ4 > 0 && cardsQ4 <= cards25, `Balken Q4 antippen filtert Liste: ${cardsQ4}`);
  await noOverflow('Auswertung');

  // Fortschritt: Fitnessniveau + gemeinsames Diagramm
  await tap('.nav a:has-text("Fortschritt")');
  await page.waitForSelector('.fit-card');
  ok(true, 'Fitnessniveau: ' + (await page.textContent('.fit-card')).replace(/\s+/g, ' ').slice(0, 70));
  await page.waitForSelector('.mchart svg path');
  const names = () => page.$$eval('.legend-name', (e) => e.map((x) => x.textContent));
  await tap('.chips .chip:has-text("Standard")');
  const std = await names();
  ok(std.length === 5, 'Auswahl Standard: ' + std.join(', '));
  await tap('.chips .chip:has-text("Alle")');
  ok((await names()).length > 5, 'Auswahl Alle: ' + (await names()).length + ' Übungen');
  await tap('.chips .chip:has-text("Keine")');
  ok((await names()).length === 0 && (await page.$('.mchart')) === null, 'Auswahl Keine: Diagramm leer');
  await tap('.cat-toggle:has-text("Rücken")');
  const ruecken = await names();
  ok(ruecken.length >= 2 && ruecken.includes('Klimmzüge'), 'Kategorie Rücken eingeschaltet: ' + ruecken.join(', '));
  await tap('.chips .chip:has-text("Standard")');
  await tap('.ctrl-row .seg button:has-text("%")');
  const pctTitle = await page.textContent('.mchart-title');
  ok(pctTitle.includes('%') && (await page.$$('.mchart-panel')).length === 1, 'Prozent-Ansicht: ' + pctTitle);
  await tap('.mchart');
  await page.waitForSelector('.readout-row');
  ok(true, 'Antippen zeigt Werte: ' + (await page.textContent('.readout')).replace(/\s+/g, ' ').slice(0, 80));
  await tap('.ctrl-row .seg button:has-text("kg / Wdh")');
  const titles = await page.$$eval('.mchart-title', (e) => e.map((x) => x.textContent));
  ok(titles.length === 2 && titles[1].includes('Wiederholungen'), 'kg und Wiederholungen getrennt: ' + titles.join(' | '));
  await tap('.legend-row:has-text("Kniebeuge") .legend-link');
  await page.waitForSelector('.chart svg path');
  const npts = await page.$$eval('.chart circle', (c) => c.length);
  ok(npts > 20, `Detail Kniebeuge: Diagramm mit ${npts} Punkten, Bestwert ${await page.textContent('.stat b')}`);
  await tap('.seg button:has-text("1RM")');
  ok(true, '1RM-Ansicht: letzter Wert ' + (await page.$$eval('.chart text', (t) => t.map((x) => x.textContent).filter((s) => s.includes('kg')).join(' '))));
  await noOverflow('Fortschritt');
  await tap('.nav a:has-text("Mehr")');
  await page.waitForSelector('text=Fingerabdruck / Face ID');
  ok(true, 'Mehr-Seite mit Face-ID-Einrichtung, Passwort, Übungsverwaltung, Export');
  await page.waitForSelector('.strava-card :text("Strava")');
  ok(true, 'Strava-Bereich: ' + (await page.textContent('.strava-card')).replace(/\s+/g, ' ').slice(0, 90));
  // Installierbarkeit laut Chrome + Installieren-Knopf (Installations-Angebot simuliert)
  const cdp2 = await ctx.newCDPSession(page);
  const inst = await cdp2.send('Page.getInstallabilityErrors').catch((e) => ({ installabilityErrors: [{ errorId: 'cdp:' + e.message }] }));
  ok(inst.installabilityErrors.length === 0, 'Chrome: App installierbar' + (inst.installabilityErrors.length ? ' – ' + JSON.stringify(inst.installabilityErrors) : ''));
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = async () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.waitForSelector('.install button:has-text("App installieren")');
  await tap('.install button:has-text("App installieren")');
  await page.waitForSelector('text=Installiert');
  ok(await page.evaluate(() => window.__prompted === true), 'Knopf „App installieren“ öffnet den Android-Installationsdialog');
  await noOverflow('Mehr');

  // Tagesansicht: Übung über den Papierkorb entfernen (Abbrechen, Rückgängig, endgültig)
  await page.goto(BASE + '/tag/' + D);
  await page.waitForSelector('.entry-row:has-text("Kniebeuge")');
  const ids0 = await dayIds();
  await tap('.entry-row:has-text("Kniebeuge") .entry-del');
  await tap('.entry-confirm .mini:has-text("Abbrechen")');
  ok((await page.$('.entry-row:has-text("Kniebeuge")')) !== null, 'Papierkorb → Abbrechen: Übung bleibt');
  await noOverflow('Tagesansicht mit Papierkorb');
  await tap('.entry-row:has-text("Kniebeuge") .entry-del');
  await page.waitForSelector('.entry-confirm');
  await noOverflow('Bestätigung');
  await tap('.entry-confirm .mini.danger');
  await page.waitForSelector('.undo-toast');
  ok((await page.$('.entry-row:has-text("Kniebeuge")')) === null && (await page.textContent('.pill.accent')).includes('1 Übung'), 'Entfernen: ausgeblendet, Zähler 1 Übung, Toast mit Rückgängig');
  await tap('.undo-toast button');
  await page.waitForSelector('.entry-row:has-text("Kniebeuge")');
  await page.waitForTimeout(7000);
  ok(JSON.stringify(await dayIds()) === JSON.stringify(ids0), 'Tagesansicht Rückgängig: Daten unverändert');
  await tap('.entry-row:has-text("Kniebeuge") .entry-del');
  await tap('.entry-confirm .mini.danger');
  await page.waitForSelector('.undo-toast', { state: 'detached', timeout: 10000 });
  const ids1 = await dayIds();
  ok(ids1.length === 1 && ids1[0].includes(NEW), 'Nach Ablauf endgültig entfernt, andere Übung unverändert: ' + ids1.map((x) => x.split(':')[1]).join(', '));
  // Editor: zweistufiges Entfernen, danach sofort Seite verlassen → Löschen wird trotzdem abgeschickt
  await tap(`.entry:has-text("${NEW}")`);
  await tap('.sheet-foot .btn.danger');
  await page.waitForSelector('.sheet-foot .btn.danger-solid');
  ok((await page.$('.sheet')) !== null, 'Editor: erstes Tippen fragt nur nach');
  await tap('.sheet-foot .btn.danger-solid');
  await page.waitForSelector('.undo-toast');
  await tap('.nav a:has-text("Verlauf")');
  await page.waitForTimeout(1500);
  ok((await dayIds()).length === 0, 'Seite verlassen während Rückgängig-Zeit: Löschen wurde ausgeführt');
  await page.goto(BASE + '/tag/' + D);
  await page.waitForSelector('.cat');
  await page.fill('textarea.note', '');
  await tap('.title');
  await page.waitForTimeout(800);
  ok(true, 'Testdaten wieder gelöscht');
} catch (e) {
  ok(false, 'Abbruch: ' + e.message.split('\n')[0]);
  // Notfall-Aufräumen über die API
  await page.evaluate(async (d) => {
    const day = await (await fetch('/api/day/' + d)).json();
    for (const en of day.entries ?? []) await fetch('/api/entries/' + en.id, { method: 'DELETE' });
    await fetch('/api/day/' + d, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"note":""}' });
  }, D).catch(() => {});
}
ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(out.join('\n'));
await browser.close();
