import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { sql } from '@/lib/db';
import { currentUid, rpFromRequest, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const uid = await currentUid();
  if (!uid) return unauthorized();
  const me = (await sql`select email from users where id = ${uid}`) as any[];
  const rows = (await sql`select id, transports from passkeys where user_id = ${uid}`) as any[];
  const { rpID } = rpFromRequest(req);
  const options = await generateRegistrationOptions({
    rpName: 'Trainingslog',
    rpID,
    userName: me[0]?.email ?? 'Trainingslog',
    userDisplayName: me[0]?.email ?? 'Trainingslog',
    userID: new TextEncoder().encode(`trainingslog-user-${uid}`),
    attestationType: 'none',
    excludeCredentials: rows.map((r) => ({ id: r.id as string, transports: r.transports ? JSON.parse(r.transports) : undefined })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  const res = NextResponse.json(options);
  res.cookies.set('tl_chal', options.challenge, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
