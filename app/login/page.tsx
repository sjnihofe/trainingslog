'use client';
import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { api } from '@/lib/format';
import { IconDumbbell, IconFace } from '@/components/Icons';

type Mode = 'login' | 'register';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [webauthn, setWebauthn] = useState(false);

  useEffect(() => { setWebauthn(typeof window !== 'undefined' && 'PublicKeyCredential' in window); }, []);

  const done = () => { window.location.href = '/'; };

  async function passkey() {
    setErr(''); setBusy(true);
    try {
      const opts = await api('/api/auth/passkey/auth-options');
      const response = await startAuthentication({ optionsJSON: opts });
      await api('/api/auth/passkey/auth-verify', { method: 'POST', body: response });
      done();
    } catch (e: any) {
      setErr(e?.name === 'NotAllowedError' ? 'Abgebrochen oder kein Passkey auf diesem Gerät – melde dich mit E-Mail an.' : e.message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (mode === 'register' && password !== password2) { setErr('Die Passwörter stimmen nicht überein'); return; }
    setBusy(true);
    try {
      await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body: { email, password } });
      done();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const switchMode = (m: Mode) => { setMode(m); setErr(''); setPassword(''); setPassword2(''); };

  return (
    <main className="shell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
        <div style={{ width: 34, height: 34 }}><IconDumbbell /></div>
      </div>
      <h1 className="title">Trainingslog</h1>
      <p className="subtitle" style={{ marginBottom: 22 }}>{mode === 'login' ? 'Melde dich an, um dein Training zu erfassen.' : 'Lege ein Konto an – deine Daten sind nur für dich sichtbar.'}</p>

      <div className="seg full" style={{ marginBottom: 18 }}>
        <button className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Anmelden</button>
        <button className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>Registrieren</button>
      </div>

      <form onSubmit={submit}>
        <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Passwort' : 'Passwort (mind. 8 Zeichen)'} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {mode === 'register' && (
          <input className="field" type="password" autoComplete="new-password" placeholder="Passwort wiederholen" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
        )}
        <button className="btn primary full" style={{ flex: 'none' }} type="submit" disabled={busy || !email || !password}>
          {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </form>

      {mode === 'login' && webauthn && (
        <>
          <div className="faint small" style={{ textAlign: 'center', margin: '16px 0 12px' }}>oder</div>
          <button className="btn full" onClick={passkey} disabled={busy}>
            <span style={{ width: 22, height: 22, display: 'inline-block' }}><IconFace /></span> Mit Fingerabdruck / Face ID anmelden
          </button>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </main>
  );
}
