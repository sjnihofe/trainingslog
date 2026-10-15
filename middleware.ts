import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';

const PUBLIC = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/passkey/auth-options',
  '/api/auth/passkey/auth-verify',
  '/manifest.webmanifest',
  '/api/strava/cron', // prüft CRON_SECRET selbst
  '/api/health/ingest', // prüft persönlichen Schlüssel selbst
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();
  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|icons/|apple-touch-icon.png|manifest.webmanifest|sw.js).*)'],
};
