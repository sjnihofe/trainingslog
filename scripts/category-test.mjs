// Test: eigene Kategorien anlegen/bearbeiten/sortieren/löschen. BASE + SESSION_TOKEN (Konto 1, nur lesend) setzen.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const out = []; const ok = (c, m) => out.push(`${c ? 'PASS' : 'FAIL'} ${m}`);
const user = { email: `test-cat-${Date.now().toString(36)}@example.com`, pw: 'TestPasswort-C1' };
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'] });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const api = (url, method = 'GET', body) => p.evaluate(async ([u, m, bd]) => { const r = await fetch(u, { method: m, headers: bd ? { 'Content-Type': 'application/json' } : {}, body: bd ? JSON.stringify(bd) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; }, [url, method, body]);
const dayCats = async () => { await p.goto(BASE + '/tag/2030-03-01'); await p.waitForSelector('.cat .cat-name'); return p.$$eval('.cat .cat-name', (e) => e.map((x) => x.textContent)); };
try {
  await p.goto(BASE + '/login');
  await p.click('.seg button:has-text("Registrieren")');
  await p.fill('input[type=email]', user.email);
  await p.fill('input[autocomplete=new-password] >> nth=0', user.pw);
  await p.fill('input[autocomplete=new-password] >> nth=1', user.pw);
  await p.click('button[type=submit]');
  await p.waitForURL(/\/tag\//);
  ok((await dayCats()).join() === 'Beine,Rücken,Brust,Schulter,Sonstiges', 'Neues Konto startet mit 5 Standard-Kategorien');

  // Anlegen
  await p.goto(BASE + '/mehr');
  await p.waitForSelector('#kategorien .catrow');
  await p.fill('#kategorien input[placeholder^="Neue Kategorie"]', 'Core');
  await p.click('#kategorien .swatch >> nth=6');
  await p.click('#kategorien button:has-text("Hinzufügen")');
  await p.waitForFunction(() => [...document.querySelectorAll('#kategorien input.catname')].some((i) => i.value === 'Core'));
  ok(true, 'Kategorie „Core“ angelegt');

  // Umbenennen
  const coreInput = p.locator('#kategorien input.catname').filter({ hasNot: p.locator('[placeholder]') }).nth(5);
  await coreInput.fill('Rumpf');
  const patched = p.waitForResponse((r) => r.url().includes('/api/categories/') && r.request().method() === 'PATCH');
  await coreInput.blur();
  ok((await patched).status() === 200, 'Umbenennen gespeichert');
  await p.waitForTimeout(400);
  let cats = (await api('/api/categories')).body;
  const rumpf = cats.find((c) => c.name === 'Rumpf');
  ok(rumpf && rumpf.color.toLowerCase() === '#f2e14c', `Umbenannt in „Rumpf“, Farbe ${rumpf?.color}`);

  // Farbe ändern + nach oben verschieben
  await p.click('#kategorien .catrow >> nth=5 >> button[aria-label="Mehr Optionen"]');
  await Promise.all([p.waitForResponse((r) => r.url().includes('/api/categories/') && r.request().method() === 'PATCH'), p.click('#kategorien .catrow >> nth=5 >> .swatch >> nth=1')]);
  for (let i = 0; i < 5; i++) {
    await Promise.all([p.waitForResponse((r) => r.url().endsWith('/api/categories') && r.request().method() === 'GET'), p.click('#kategorien .catrow >> nth=' + (5 - i) + ' >> button[aria-label="Nach oben"]')]);
    await p.waitForTimeout(150);
  }
  const order = await dayCats();
  ok(order[0] === 'Rumpf' && order.length === 6, 'Reihenfolge in der Tagesansicht: ' + order.join(', '));
  const dot = await p.$eval('.cat .cat-dot', (e) => getComputedStyle(e).backgroundColor);
  ok(dot === 'rgb(63, 184, 255)', 'Neue Farbe sichtbar: ' + dot);

  // Übung in der neuen Kategorie anlegen und trainieren
  await p.click('.cat-head:has-text("Rumpf")');
  await p.fill('.sheet .search', 'Plank Test');
  await p.click('.sheet .newbtn');
  await p.waitForSelector('.setrow');
  await p.fill('.setrow >> nth=0 >> input[inputmode=decimal]', '10');
  await p.fill('.setrow >> nth=1 >> input[inputmode=decimal]', '10');
  await p.click('.sheet-foot .btn.primary');
  await p.waitForSelector('.cat:has-text("Rumpf") .entry:has-text("Plank Test")');
  ok(true, 'Übung in „Rumpf“ angelegt und gespeichert');
  await p.goto(BASE + '/fortschritt');
  await p.click('.chip:has-text("Alle")');
  await p.waitForSelector('.chip:has-text("Rumpf")');
  await p.click('.chip:has-text("Rumpf")');
  ok((await p.$$eval('.entry-name', (e) => e.map((x) => x.textContent))).join() === 'Plank Test', 'Fortschritt-Filter nach eigener Kategorie');

  // Doppelter Name, Löschen mit Verschieben
  const dup = await api('/api/categories', 'POST', { name: 'rumpf' });
  ok(dup.status === 409, 'Doppelter Kategoriename abgelehnt');
  await p.goto(BASE + '/mehr');
  await p.waitForSelector('#kategorien .catrow');
  await p.click('#kategorien .catrow >> nth=0 >> button[aria-label="Mehr Optionen"]');
  await p.selectOption('#kategorien .catrow >> nth=0 >> select', { label: 'Übungen nach „Sonstiges“' });
  await p.click('#kategorien .catrow >> nth=0 >> button:has-text("Löschen")');
  await p.waitForFunction(() => ![...document.querySelectorAll('#kategorien input.catname')].some((i) => i.value === 'Rumpf'));
  const ex = (await api('/api/exercises')).body.find((e) => e.name === 'Plank Test');
  ok(ex?.category === 'Sonstiges', 'Gelöscht, Übung nach „Sonstiges“ verschoben (Training bleibt erhalten)');
  const day = (await api('/api/day/2030-03-01')).body;
  ok(day.entries.length === 1 && day.entries[0].category === 'Sonstiges', 'Eintrag des Tages hängt jetzt an „Sonstiges“');

  // Fremde Kategorie nicht änderbar; Konto 1 unverändert
  const ctx1 = await b.newContext();
  await ctx1.addCookies([{ name: 'tl_session', value: process.env.SESSION_TOKEN, url: BASE }]);
  const p1 = await ctx1.newPage(); await p1.goto(BASE + '/login');
  const c1 = await p1.evaluate(async () => (await fetch('/api/categories')).json());
  const hack = await api(`/api/categories/${c1[0].id}`, 'PATCH', { name: 'gehackt' });
  const hackDel = await api(`/api/categories/${c1[0].id}`, 'DELETE');
  const c1b = await p1.evaluate(async () => (await fetch('/api/categories')).json());
  ok(hack.status === 404 && hackDel.status === 404 && c1b.map((c) => c.name).join() === c1.map((c) => c.name).join() && c1.length === 5, 'Fremde Kategorien geschützt, Konto 1: ' + c1b.map((c) => c.name).join(', '));
  await ctx1.close();
} catch (e) { ok(false, 'Abbruch: ' + e.message.split('\n')[0]); }
ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(out.join('\n'));
console.log('TESTUSER=' + user.email);
await b.close();
