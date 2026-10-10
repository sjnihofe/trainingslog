'use client';
import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { api } from '@/lib/format';
import { IconDumbbell, IconFace } from '@/components/Icons';

export default function Login() {
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/api/auth/status').then((d) => setHasPasskeys(d.hasPasskeys)).catch(() => {}); }, []);

  const done = () => { window.location.href = '/'; };

  async function faceId() {
    setErr(''); setBusy(true);
    try {
      const opts = await api('/api/auth/passkey/auth-options');
      const response = await startAuthentication({ optionsJSON: opts });
      await api('/api/auth/passkey/auth-verify', { method: 'POST', body: response });
      done();
    } catch (e: any) {
      setErr(e?.name === 'NotAllowedError' ? 'Abgebrochen – versuch es nochmal oder nutze das Passwort.' : e.message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await api('/api/auth/login', { method: 'POST', body: { password } }); done(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <main className="shell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
        <div style={{ width: 34, height: 34 }}><IconDumbbell /></div>
      </div>
      <h1 className="title">Trainingslog</h1>
      <p className="subtitle" style={{ marginBottom: 28 }}>Melde dich an, um dein Training zu erfassen.</p>

      {hasPasskeys && (
        <>
          <button className="btn primary full" style={{ flex: 'none', marginBottom: 18 }} onClick={faceId} disabled={busy}>
            <span style={{ width: 22, height: 22, display: 'inline-block' }}><IconFace /></span> Mit Face ID anmelden
          </button>
          <div className="faint small" style={{ textAlign: 'center', marginBottom: 14 }}>oder mit Passwort</div>
        </>
      )}

      <form onSubmit={submit}>
        <input className="field" type="password" placeholder="Passwort" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={!hasPasskeys} />
        <button className={`btn full ${hasPasskeys ? '' : 'primary'}`} type="submit" disabled={busy || !password}>Anmelden</button>
      </form>
      {err && <p className="err">{err}</p>}
    </main>
  );
}
