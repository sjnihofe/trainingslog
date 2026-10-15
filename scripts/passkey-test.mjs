// Passkey-Test mit virtuellem Authenticator (Chrome DevTools). BASE + SESSION_TOKEN setzen.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const out = []; const ok = (c, m) => out.push(`${c ? 'PASS' : 'FAIL'} ${m}`);
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['Pixel 7'] });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('WebAuthn.enable');
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
try {
  await ctx.addCookies([{ name: 'tl_session', value: process.env.SESSION_TOKEN, url: BASE }]);
  await p.goto(BASE + '/mehr');
  await p.click('button:has-text("Auf diesem Gerät einrichten")');
  await p.waitForSelector('.okmsg:has-text("eingerichtet")');
  ok(true, 'Passkey eingerichtet');
  await p.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
  await p.goto(BASE + '/login');
  await p.click('button:has-text("Fingerabdruck")');
  await p.waitForURL(/\/tag\//);
  const me = await p.evaluate(async () => (await fetch('/api/auth/me')).json());
  ok(Boolean(me.email), 'Login per Passkey ohne E-Mail-Eingabe → Konto ' + me.email);
  // Aufräumen: Test-Passkey entfernen
  const keys = await p.evaluate(async () => (await fetch('/api/auth/passkey/list')).json());
  const mine = keys[keys.length - 1];
  await p.evaluate((id) => fetch('/api/auth/passkey/list', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }), mine.id);
  ok(true, 'Test-Passkey wieder entfernt');
} catch (e) { ok(false, 'Abbruch: ' + e.message.split('\n')[0]); }
console.log(out.join('\n'));
await b.close();
