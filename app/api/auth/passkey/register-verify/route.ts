import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { sql } from '@/lib/db';
import { bad, rpFromRequest } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const challenge = (await cookies()).get('tl_chal')?.value;
  if (!body?.response || !challenge) return bad('Einrichtung abgelaufen, bitte erneut versuchen');
  const { rpID, origin } = rpFromRequest(req);
  try {
    const result = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo) return bad('Einrichtung fehlgeschlagen');
    const { credential } = result.registrationInfo;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : 'Gerät';
    await sql`insert into passkeys (id, public_key, counter, transports, device_name)
      values (${credential.id}, ${Buffer.from(credential.publicKey).toString('base64url')}, ${credential.counter},
              ${JSON.stringify(credential.transports ?? [])}, ${name})
      on conflict (id) do nothing`;
  } catch (e: any) {
    return bad('Einrichtung fehlgeschlagen: ' + (e?.message ?? ''));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tl_chal', '', { path: '/', maxAge: 0 });
  return res;
}
