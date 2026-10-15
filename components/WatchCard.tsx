'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/format';
import { IconWatch } from './Icons';

type Status = { exists: boolean; created_at?: string; last_used?: string | null; last_data?: string | null; workouts: number };
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'noch nie');

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn" style={{ height: 40, fontSize: 14 }} onClick={async () => {
      try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* manuell kopieren */ }
    }}>{done ? 'Kopiert ✓' : label}</button>
  );
}

export default function WatchCard() {
  const [st, setSt] = useState<Status | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const load = () => api<Status>('/api/health/token').then(setSt).catch(() => {});
  useEffect(() => { setOrigin(window.location.origin); load(); }, []);

  const url = `${origin}/api/health/ingest`;
  const create = async () => { const r = await api<{ token: string }>('/api/health/token', { method: 'POST' }); setToken(r.token); load(); };
  const revoke = async () => { await api('/api/health/token', { method: 'DELETE' }); setToken(null); load(); };
  const auth = token ? `Bearer ${token}` : 'Bearer <dein Schlüssel>';

  return (
    <div className="card watch-card-settings">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="watch-badge"><IconWatch />Apple Watch</span>
        <span className="faint small" style={{ marginLeft: 'auto' }}>über iPhone-Kurzbefehle</span>
      </div>
      <p className="muted small" style={{ margin: '0 0 10px' }}>
        Überträgt nach jedem Apple-Watch-Training Dauer, aktive Kalorien und Puls (Ø / max) in die App.
        {st && st.workouts > 0 && <><br />{st.workouts} Trainings empfangen · zuletzt {fmt(st.last_data)}</>}
      </p>

      {token ? (
        <>
          <p className="small" style={{ margin: '0 0 4px' }}><b>Dein persönlicher Schlüssel</b> – wird nur jetzt angezeigt:</p>
          <div className="token-box">{token}</div>
          <div className="row" style={{ marginBottom: 10 }}><Copy value={`Bearer ${token}`} label="„Bearer …“ kopieren" /><Copy value={url} label="Adresse kopieren" /></div>
        </>
      ) : st?.exists ? (
        <p className="faint small" style={{ margin: '0 0 10px' }}>Schlüssel aktiv seit {fmt(st.created_at)} · zuletzt benutzt {fmt(st.last_used)}. Aus Sicherheitsgründen wird er nicht erneut angezeigt.</p>
      ) : null}

      <div className="row">
        <button className={`btn ${st?.exists ? '' : 'primary'}`} style={{ flex: 1 }} onClick={create}>{st?.exists ? 'Neuen Schlüssel erzeugen' : 'Schlüssel erzeugen'}</button>
        {st?.exists && <button className="btn danger" onClick={revoke}>Widerrufen</button>}
      </div>

      <details className="howto" style={{ marginTop: 12 }}>
        <summary>Einrichtung auf dem iPhone (ca. 10 Minuten)</summary>
        <p className="muted small">Alles in der App <b>Kurzbefehle</b>. Bei jeder Aktion „Inhalte von URL abrufen“ gilt: Adresse <code>{url || '…/api/health/ingest'}</code>, Methode <b>POST</b>, Header <code>Authorization</code> = <code>{auth}</code>, Hauptteil <b>JSON</b>.</p>
        <ol className="steps">
          <li><b>Automation „Training beginnt“:</b> Automation → <b>+</b> → <b>Apple Watch-Training</b> → Trainingsart z. B. <i>Traditionelles Krafttraining</i> → <b>Beginnt</b> → <b>Sofort ausführen</b>. Aktion <b>Inhalte von URL abrufen</b> mit JSON-Feld <code>event</code> = <code>start</code>.</li>
          <li><b>Automation „Training endet“:</b> wie oben, aber <b>Endet</b>. Aktionen:
            <ol type="a">
              <li><b>Health-Samples suchen</b>: Typ <i>Herzfrequenz</i>, Startdatum „in den letzten 4 Stunden“, sortiert nach Startdatum.</li>
              <li>Noch einmal <b>Health-Samples suchen</b>: Typ <i>Aktive Energie</i>, ebenfalls „in den letzten 4 Stunden“.</li>
              <li><b>Inhalte von URL abrufen</b> mit JSON-Feldern (alle Typ <i>Text</i>):
                <code>event</code> = <code>end</code> ·
                <code>hr_values</code> = Health-Samples (1) → <i>Wert</i> ·
                <code>hr_dates</code> = Health-Samples (1) → <i>Startdatum</i>, Datumsformat <b>ISO 8601</b> ·
                <code>kcal_values</code> = Health-Samples (2) → <i>Wert</i> ·
                <code>kcal_dates</code> = Health-Samples (2) → <i>Startdatum</i>, <b>ISO 8601</b>.</li>
              <li><b>Mitteilung anzeigen</b> mit dem Ergebnis von „Inhalte von URL“ – so siehst du sofort, was gespeichert wurde.</li>
            </ol>
          </li>
          <li><b>Kurzbefehl „Trainingswerte senden“</b> (für den Fall, dass das iPhone beim Trainingsende gesperrt war): den Kurzbefehl aus Schritt 2 duplizieren, beide Zeiträume auf „in den letzten 24 Stunden“ und <code>event</code> auf <code>data</code> ändern. Nach dem Training einmal antippen – oder als Automation „App → Fitness wird geöffnet“.</li>
        </ol>
        <p className="faint small">Beim ersten Ausführen fragt das iPhone, ob Kurzbefehle auf Health-Daten zugreifen darf – erlauben. Die genauen Bezeichnungen können je nach iOS-Version leicht abweichen.</p>
      </details>
    </div>
  );
}
