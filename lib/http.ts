import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from './session';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withSession(res: NextResponse, uid: number) {
  res.cookies.set(SESSION_COOKIE, await createSessionToken(uid), sessionCookieOptions);
  return res;
}

/** Angemeldete Nutzer-ID aus dem Session-Cookie (null, wenn nicht angemeldet). */
export async function currentUid() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export const unauthorized = () => NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

// Relying-Party (Domain) für Passkeys aus dem Request ableiten
export function rpFromRequest(req: Request) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost';
  const rpID = host.split(':')[0];
  const proto = req.headers.get('x-forwarded-proto') ?? (rpID === 'localhost' ? 'http' : 'https');
  return { rpID, origin: `${proto}://${host}` };
}
