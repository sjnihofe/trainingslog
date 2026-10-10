import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { sql } from '@/lib/db';
import { bad, rpFromRequest, withSession } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const challenge = (await cookies()).get('tl_chal')?.value;
  if (!body?.id || !challenge) return bad('Anmeldung abgelaufen, bitte erneut versuchen');
  const rows = (await sql`select id, public_key, counter, transports from passkeys where id = ${body.id}`) as any[];
  if (!rows.length) return bad('Unbekannter Passkey', 401);
  const pk = rows[0];
  const { rpID, origin } = rpFromRequest(req);
  try {
    const result = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: pk.id,
        publicKey: new Uint8Array(Buffer.from(pk.public_key, 'base64url')),
        counter: Number(pk.counter),
        transports: pk.transports ? JSON.parse(pk.transports) : undefined,
      },
    });
    if (!result.verified) return bad('Face ID fehlgeschlagen', 401);
    await sql`update passkeys set counter = ${result.authenticationInfo.newCounter}, last_used = now() where id = ${pk.id}`;
  } catch (e: any) {
    return bad('Face ID fehlgeschlagen: ' + (e?.message ?? ''), 401);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tl_chal', '', { path: '/', maxAge: 0 });
  return withSession(res);
}
