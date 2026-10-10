'use client';
import { useEffect, useState } from 'react';
import { canInstall, isStandalone, onInstallChange, promptInstall, wasInstalled } from '@/lib/install';

export default function InstallCard() {
  const [, rerender] = useState(0);
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setEnv({ standalone: isStandalone(), ios: /iPhone|iPad|iPod/.test(navigator.userAgent) });
    return onInstallChange(() => rerender((n) => n + 1));
  }, []);

  if (!env) return null;
  if (env.standalone) return null; // läuft bereits als installierte App

  if (wasInstalled()) {
    return <div className="card okmsg" style={{ margin: '0 0 10px' }}>✓ Installiert – du findest „Training“ jetzt auf deinem Startbildschirm.</div>;
  }

  return (
    <div className="card install">
      <b style={{ display: 'block', marginBottom: 6 }}>App auf dem Startbildschirm</b>
      {canInstall() ? (
        <>
          <p className="muted small" style={{ margin: '0 0 10px' }}>Installiert die App mit eigenem Symbol – sie startet dann im Vollbild ohne Browserleiste.</p>
          <button
            className="btn primary full"
            onClick={async () => { const ok = await promptInstall(); if (!ok) setMsg('Abgebrochen – du kannst es jederzeit erneut versuchen.'); }}
          >
            App installieren
          </button>
          {msg && <p className="muted small">{msg}</p>}
        </>
      ) : env.ios ? (
        <p className="muted small" style={{ margin: 0 }}>Auf dem iPhone: unten in Safari auf <b>Teilen</b> (Quadrat mit Pfeil) tippen und <b>„Zum Home-Bildschirm“</b> wählen.</p>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          Chrome bietet die Installation gerade noch nicht an. Lade die Seite neu und warte ein paar Sekunden – dann erscheint hier der Knopf.
          Alternativ: Chrome-Menü <b>⋮</b> → <b>„Zum Startbildschirm hinzufügen“</b>.
        </p>
      )}
    </div>
  );
}
