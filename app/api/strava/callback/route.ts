import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { saveConnection, stravaConfigured, syncRuns, tokenRequest } from '@/lib/strava';
import { currentUid, rpFromRequest } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { origin } = rpFromRequest(req);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${origin}/mehr?strava=${status}`);
    res.cookies.set('tl_strava_state', '', { path: '/', maxAge: 0 });
    return res;
  };
  const uid = await currentUid();
  if (!uid) return NextResponse.redirect(`${origin}/login`);
  if (!stravaConfigured()) return back('nicht-eingerichtet');
  const url = new URL(req.url);
  const state = (await cookies()).get('tl_strava_state')?.value;
  if (url.searchParams.get('error')) return back('abgebrochen');
  if (!state || state !== url.searchParams.get('state')) return back('fehler');
  const scope = url.searchParams.get('scope') ?? '';
  if (!/activity:read/.test(scope)) return back('keine-berechtigung');
  try {
    const t = await tokenRequest({ code: url.searchParams.get('code') ?? '', grant_type: 'authorization_code' });
    await saveConnection(uid, t, scope);
  } catch {
    return back('fehler');
  }
  try { await syncRuns(uid, true); } catch { /* Erstabgleich darf scheitern – läuft beim nächsten Öffnen erneut */ }
  return back('verbunden');
}
