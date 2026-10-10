import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { sql } from '@/lib/db';
import { rpFromRequest } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rows = (await sql`select id, transports from passkeys`) as any[];
  const { rpID } = rpFromRequest(req);
  const options = await generateRegistrationOptions({
    rpName: 'Trainingslog',
    rpID,
    userName: 'Trainingslog',
    userDisplayName: 'Trainingslog',
    userID: new TextEncoder().encode('trainingslog-owner'),
    attestationType: 'none',
    excludeCredentials: rows.map((r) => ({ id: r.id as string, transports: r.transports ? JSON.parse(r.transports) : undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  });
  const res = NextResponse.json(options);
  res.cookies.set('tl_chal', options.challenge, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
