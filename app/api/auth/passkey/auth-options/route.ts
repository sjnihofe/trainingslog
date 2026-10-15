import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { rpFromRequest } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ohne allowCredentials: das Handy bietet alle Passkeys für diese Domain an (Konto wird am Passkey erkannt)
export async function GET(req: Request) {
  const { rpID } = rpFromRequest(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  const res = NextResponse.json(options);
  res.cookies.set('tl_chal', options.challenge, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 300 });
  return res;
}
