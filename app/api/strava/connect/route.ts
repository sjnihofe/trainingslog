import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { STRAVA_OAUTH, stravaConfigured } from '@/lib/strava';
import { rpFromRequest } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { origin } = rpFromRequest(req);
  if (!stravaConfigured()) return NextResponse.redirect(`${origin}/mehr?strava=nicht-eingerichtet`);
  const state = randomBytes(16).toString('base64url');
  const url = new URL(`${STRAVA_OAUTH}/authorize`);
  url.searchParams.set('client_id', process.env.STRAVA_CLIENT_ID!);
  url.searchParams.set('redirect_uri', `${origin}/api/strava/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', 'activity:read_all');
  url.searchParams.set('state', state);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set('tl_strava_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
