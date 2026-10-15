// Test Registrierung, Login und Datentrennung zwischen Konten. BASE + SESSION_TOKEN (Konto 1) setzen.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const out = [];
const ok = (c, m) => out.push(`${c ? 'PASS' : 'FAIL'} ${m}`);
const stamp = Date.now().toString(36);
const A = { email: `test-a-${stamp}@example.com`, pw: 'TestPasswort-A1' };
const b = await chromium.launch();
const errors = [];

async function newUser(user) {
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(BASE + '/');
  await p.waitForURL(/\/login/);
  await p.click('.seg button:has-text("Registrieren")');
  await p.fill('input[type=email]', user.email);
  await p.fill('input[autocomplete=new-password] >> nth=0', user.pw);
  await p.fill('input[autocomplete=new-password] >> nth=1', user.pw);
  await p.click('button[type=submit]');
  await p.waitForURL(/\/tag\//);
  return { ctx, p };
}
const apiGet = (p, url) => p.evaluate(async (u) => { const r = await fetch(u); return { status: r.status, body: await r.json().catch(() => null) }; }, url);
const apiSend = (p, url, method, body) => p.evaluate(async ([u, m, bd]) => { const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bd) }); return { status: r.status, body: await r.json().catch(() => null) }; }, [url, method, body]);

try {
  // Registrierung
  const { ctx, p } = await newUser(A);
  ok(true, 'Registrierung mit E-Mail → direkt eingeloggt');
  const me = await apiGet(p, '/api/auth/me');
  ok(me.body?.email === A.email, 'Konto: ' + me.body?.email);

  // Neues Konto ist leer, hat aber Startübungen
  const w = await apiGet(p, '/api/workouts');
  ok(Array.isArray(w.body) && w.body.length === 0, 'Neues Konto sieht keine fremden Trainings (0)');
  const ex = await apiGet(p, '/api/exercises');
  ok(ex.body.length >= 10 && ex.body.every((e) => e.uses === 0), `Startübungen angelegt: ${ex.body.length}, Standard: ${ex.body.filter((e) => e.favorite).map((e) => e.name).join(', ')}`);
  const runs = await apiGet(p, '/api/runs');
  ok(runs.body.length === 0, 'Keine fremden Läufe');

  // Eintrag im neuen Konto
  const kb = ex.body.find((e) => e.name === 'Kniebeuge');
  const made = await apiSend(p, '/api/entries', 'POST', { date: '2030-02-01', exerciseId: kb.id, sets: [{ reps: 5, weight: 40, bodyweight: false }] });
  ok(made.status === 200, 'Konto A speichert Training');

  // Konto 1 (Niklas) per Test-Session
  const ctx1 = await b.newContext({ ...devices['Pixel 7'] });
  await ctx1.addCookies([{ name: 'tl_session', value: process.env.SESSION_TOKEN, url: BASE }]);
  const p1 = await ctx1.newPage();
  await p1.goto(BASE + '/mehr');
  const w1 = await apiGet(p1, '/api/workouts');
  ok(w1.body.length >= 44 && !w1.body.some((x) => x.date === '2030-02-01'), `Konto 1 sieht nur eigene Trainings (${w1.body.length}), nicht das von A`);
  const ex1 = await apiGet(p1, '/api/exercises');
  ok(!ex1.body.some((e) => e.id === kb.id), 'Konto 1 sieht A’s Übungen nicht');

  // Fremdzugriffe von A auf Daten von Konto 1
  const day1 = await apiGet(p1, '/api/day/2026-10-10');
  const foreignEntry = day1.body.entries[0]?.id;
  const foreignEx = ex1.body[0]?.id;
  const r1 = await apiSend(p, `/api/entries/${foreignEntry}`, 'PUT', { sets: [{ reps: 1, weight: 1 }] });
  const r2 = await apiSend(p, `/api/entries/${foreignEntry}`, 'DELETE', {});
  const r3 = await apiGet(p, `/api/exercises/${foreignEx}/history`);
  const r4 = await apiSend(p, `/api/exercises/${foreignEx}`, 'PATCH', { name: 'gehackt' });
  const r5 = await apiSend(p, '/api/entries', 'POST', { date: '2030-02-02', exerciseId: foreignEx, sets: [{ reps: 1, weight: 1 }] });
  const ex1b = await apiGet(p1, '/api/exercises');
  const day1b = await apiGet(p1, '/api/day/2026-10-10');
  ok(r1.status === 404 && r2.status === 404 && r3.status === 404 && r5.status === 404 && !ex1b.body.some((e) => e.name === 'gehackt') && day1b.body.entries.length === day1.body.entries.length,
    `Fremdzugriff blockiert: PUT ${r1.status}, DELETE ${r2.status}, Verlauf ${r3.status}, PATCH ohne Wirkung, POST ${r5.status}`);

  // Abmelden + Login mit E-Mail
  await apiSend(p, '/api/auth/logout', 'POST', {});
  const after = await apiGet(p, '/api/workouts');
  ok(after.status === 401, 'Nach Abmelden kein Zugriff (401)');
  await p.goto(BASE + '/login');
  await p.fill('input[type=email]', A.email);
  await p.fill('input[type=password]', 'falsch-falsch');
  await p.click('button[type=submit]');
  await p.waitForSelector('.err');
  ok((await p.textContent('.err')).includes('falsch'), 'Falsches Passwort abgelehnt');
  await p.fill('input[type=email]', A.email.toUpperCase());
  await p.fill('input[type=password]', A.pw);
  await p.click('button[type=submit]');
  await p.waitForURL(/\/tag\//);
  ok(true, 'Login mit E-Mail (Groß/Klein egal)');

  // Doppelte Registrierung
  const dup = await apiSend(p, '/api/auth/register', 'POST', { email: A.email, password: 'IrgendwasLang1' });
  ok(dup.status === 409, 'Doppelte Registrierung abgelehnt (409)');
  const weak = await apiSend(p, '/api/auth/register', 'POST', { email: 'x' + A.email, password: 'kurz' });
  ok(weak.status === 400, 'Zu kurzes Passwort abgelehnt');

  await ctx.close(); await ctx1.close();
} catch (e) {
  ok(false, 'Abbruch: ' + e.message.split('\n')[0]);
}
ok(errors.length === 0, 'Keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
console.log(out.join('\n'));
console.log('TESTUSER=' + A.email);
await b.close();
