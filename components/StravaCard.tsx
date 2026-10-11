'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/format';

type Status = { configured: boolean; connected: boolean; athlete_name?: string | null; last_sync?: string | null; runs: number; totalKm: number };

const MSG: Record<string, [boolean, string]> = {
  verbunden: [true, 'Strava ist verbunden – deine Läufe wurden importiert.'],
  abgebrochen: [false, 'Verbindung abgebrochen.'],
  'keine-berechtigung': [false, 'Bitte beim Verbinden den Zugriff auf Aktivitäten erlauben.'],
  'nicht-eingerichtet': [false, 'Die Strava-Zugangsdaten sind noch nicht hinterlegt (siehe unten).'],
  fehler: [false, 'Verbindung fehlgeschlagen – bitte erneut versuchen.'],
};

const fmtTime = (s?: string | null) => (s ? new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'noch nie');

export default function StravaCard() {
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[boolean, string] | null>(null);

  const load = () => api<Status>('/api/strava/status').then(setSt).catch(() => {});
  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search).get('strava');
    if (p && MSG[p]) {
      setMsg(MSG[p]);
      window.history.replaceState(window.history.state, '', '/mehr');
    }
  }, []);

  async function sync(full = false) {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ synced: number }>('/api/strava/sync', { method: 'POST', body: { full } });
      setMsg([true, r.synced ? `${r.synced} ${r.synced === 1 ? 'Lauf' : 'Läufe'} abgeglichen.` : 'Alles aktuell.']);
    } catch (e: any) { setMsg([false, e.message]); }
    setBusy(false); load();
  }

  async function disconnect() {
    setBusy(true);
    await api('/api/strava/disconnect', { method: 'POST', body: { deleteRuns: false } }).catch(() => {});
    setMsg([true, 'Strava getrennt. Bereits importierte Läufe bleiben erhalten.']);
    setBusy(false); load();
  }

  return (
    <div className="card strava-card">
      <div className="row" style={{ marginBottom: 8 }}>
        <b>Strava</b>
        {st?.connected && <span className="run-badge" style={{ marginLeft: 'auto' }}>verbunden</span>}
      </div>
      {!st ? <p className="muted small">Lade …</p> : !st.configured ? (
        <p className="muted small" style={{ margin: 0 }}>
          Noch nicht eingerichtet: In Vercel fehlen <b>STRAVA_CLIENT_ID</b> und <b>STRAVA_CLIENT_SECRET</b>. Danach erscheint hier „Mit Strava verbinden“.
        </p>
      ) : !st.connected ? (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>Läufe werden automatisch übernommen (nur lesend) und erscheinen im Kalender und in der Auswertung.</p>
          <a className="btn strava full" href="/api/strava/connect">Mit Strava verbinden</a>
          {st.runs > 0 && <p className="faint small">{st.runs} früher importierte Läufe vorhanden.</p>}
        </>
      ) : (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>
            {st.athlete_name ? <>Konto: <b>{st.athlete_name}</b> · </> : null}
            {st.runs} Läufe · {String(st.totalKm).replace('.', ',')} km<br />
            Letzter Abgleich: {fmtTime(st.last_sync)} (automatisch beim Öffnen des Verlaufs und täglich)
          </p>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => sync(false)}>{busy ? 'Läuft …' : 'Jetzt abgleichen'}</button>
            <button className="btn" disabled={busy} onClick={() => sync(true)}>Alles neu laden</button>
          </div>
          <button className="faint small" style={{ marginTop: 10 }} disabled={busy} onClick={disconnect}>Strava trennen</button>
        </>
      )}
      {msg && <p className={msg[0] ? 'okmsg' : 'err'}>{msg[1]}</p>}
      <p className="faint small" style={{ margin: '10px 0 0' }}>Powered by Strava</p>
    </div>
  );
}
