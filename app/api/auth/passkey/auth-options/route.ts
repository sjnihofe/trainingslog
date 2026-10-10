import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { sql } from '@/lib/db';
import { bad, rpFromRequest } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rows = (await sql`select id, transports from passkeys`) as any[];
  if (!rows.length) return bad('Kein Face ID / Passkey eingerichtet', 404);
  const { rpID } = rpFromRequest(req);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: rows.map((r) => ({ id: r.id as string, transports: r.transports ? JSON.parse(r.transports) : undefined })),
  });
  const res = NextResponse.json(options);
  res.cookies.set('tl_chal', options.challenge, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
