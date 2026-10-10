import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from './session';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return res;
}

// Relying-Party (Domain) für Passkeys aus dem Request ableiten
export function rpFromRequest(req: Request) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = req.headers.get('x-forwarded-proto') ?? (rpID === 'localhost' ? 'http' : 'https');
  return { rpID, origin: `${proto}://${host}` };
}
