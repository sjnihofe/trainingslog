// Strava-Anbindung (nur lesend): OAuth-Tokens verschlüsselt in der DB, Läufe in Tabelle "runs".
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { sql } from './db';

// Ab 04.01.2027 neue Basis-URL laut Strava-Changelog – per Env umstellbar
export const STRAVA_API = process.env.STRAVA_API_BASE ?? 'https://www.strava.com/api/v3';
export const STRAVA_OAUTH = process.env.STRAVA_OAUTH_BASE ?? 'https://www.strava.com/oauth';
export const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];

export const stravaConfigured = () => Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

// AES-256-GCM, Schlüssel aus SESSION_SECRET abgeleitet
const key = () => createHash('sha256').update('strava-tokens:' + process.env.SESSION_SECRET).digest();
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}
export function decrypt(blob: string) {
  const [iv, tag, ct] = blob.split('.').map((x) => Buffer.from(x, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

type TokenResponse = {
  access_token: string; refresh_token: string; expires_at: number; scope?: string;
  athlete?: { id: number; firstname?: string; lastname?: string };
};

export async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, ...params }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Strava-Anmeldung fehlgeschlagen: ' + (data?.message ?? res.status));
  return data;
}

export async function saveConnection(t: TokenResponse, scope: string) {
  const a = t.athlete!;
  const name = [a.firstname, a.lastname].filter(Boolean).join(' ') || null;
  await sql`insert into strava_auth (id, athlete_id, athlete_name, scope, access_token_enc, refresh_token_enc, expires_at, connected_at)
    values (1, ${a.id}, ${name}, ${scope}, ${encrypt(t.access_token)}, ${encrypt(t.refresh_token)}, ${t.expires_at}, now())
    on conflict (id) do update set athlete_id = excluded.athlete_id, athlete_name = excluded.athlete_name, scope = excluded.scope,
      access_token_enc = excluded.access_token_enc, refresh_token_enc = excluded.refresh_token_enc,
      expires_at = excluded.expires_at, connected_at = now(), last_sync = null`;
}

export async function getAccessToken(): Promise<string | null> {
  const rows = (await sql`select access_token_enc, refresh_token_enc, expires_at from strava_auth where id = 1`) as any[];
  if (!rows.length) return null;
  const r = rows[0];
  if (Number(r.expires_at) - 300 > Date.now() / 1000) return decrypt(r.access_token_enc);
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(r.refresh_token_enc) });
  await sql`update strava_auth set access_token_enc = ${encrypt(t.access_token)}, refresh_token_enc = ${encrypt(t.refresh_token)},
    expires_at = ${t.expires_at} where id = 1`;
  return t.access_token;
}

/** Holt Läufe von Strava. full = gesamte Historie, sonst ab letztem Lauf (minus 14 Tage für nachträgliche Änderungen). */
export async function syncRuns(full = false) {
  const token = await getAccessToken();
  if (!token) return { connected: false, synced: 0 };
  let after = 0;
  if (!full) {
    const m = (await sql`select extract(epoch from max(start_time))::bigint as t from runs`) as any[];
    if (m[0]?.t) after = Number(m[0].t) - 14 * 86400;
  }
  let synced = 0;
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${STRAVA_API}/athlete/activities?after=${after}&per_page=200&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.status === 401) throw new Error('Strava-Zugriff ungültig – bitte unter „Mehr“ neu verbinden.');
    if (res.status === 429) throw new Error('Strava-Limit erreicht – später erneut versuchen.');
    if (!res.ok) throw new Error('Strava-API-Fehler ' + res.status);
    const acts = (await res.json()) as any[];
    if (!Array.isArray(acts) || acts.length === 0) break;
    const runs = acts.filter((a) => RUN_TYPES.includes(a.sport_type ?? a.type) && a.distance > 0);
    if (runs.length) {
      await sql`insert into runs (strava_id, start_time, start_date, name, sport_type, distance_m, moving_time_s, elapsed_time_s, elevation_gain_m, avg_hr, updated_at)
        select t.id, t.st, t.sd, t.nm, t.sp, t.di, t.mt, t.et, t.el, t.hr, now()
        from unnest(${runs.map((a) => String(a.id))}::bigint[], ${runs.map((a) => a.start_date)}::timestamptz[],
                    ${runs.map((a) => String(a.start_date_local).slice(0, 10))}::date[], ${runs.map((a) => a.name ?? null)}::text[],
                    ${runs.map((a) => a.sport_type ?? a.type)}::text[], ${runs.map((a) => a.distance)}::numeric[],
                    ${runs.map((a) => a.moving_time)}::int[], ${runs.map((a) => a.elapsed_time ?? null)}::int[],
                    ${runs.map((a) => a.total_elevation_gain ?? null)}::numeric[], ${runs.map((a) => a.average_heartrate ?? null)}::numeric[])
             as t(id, st, sd, nm, sp, di, mt, et, el, hr)
        on conflict (strava_id) do update set start_time = excluded.start_time, start_date = excluded.start_date, name = excluded.name,
          sport_type = excluded.sport_type, distance_m = excluded.distance_m, moving_time_s = excluded.moving_time_s,
          elapsed_time_s = excluded.elapsed_time_s, elevation_gain_m = excluded.elevation_gain_m, avg_hr = excluded.avg_hr, updated_at = now()`;
      synced += runs.length;
    }
    if (acts.length < 200) break;
  }
  await sql`update strava_auth set last_sync = now() where id = 1`;
  return { connected: true, synced };
}

/** Synchronisiert nur, wenn der letzte Abgleich länger als `minutes` her ist. Fehler werden geschluckt. */
export async function syncIfStale(minutes = 10) {
  if (!stravaConfigured()) return;
  try {
    const rows = (await sql`select last_sync from strava_auth where id = 1 and (last_sync is null or last_sync < now() - make_interval(mins => ${minutes}))`) as any[];
    if (rows.length) await syncRuns(false);
  } catch {
    /* Anzeige soll nicht an Strava scheitern */
  }
}

