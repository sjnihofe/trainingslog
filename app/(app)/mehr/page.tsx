'use client';
import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { api, fmtShort } from '@/lib/format';
import CategoryManager from '@/components/CategoryManager';
import { useCategories } from '@/lib/useCategories';
import type { Exercise } from '@/components/types';
import { IconFace } from '@/components/Icons';
import InstallCard from '@/components/InstallCard';
import StravaCard from '@/components/StravaCard';
import WatchCard from '@/components/WatchCard';

type Passkey = { id: string; device_name: string; created_at: string; last_used: string | null };

export default function Mehr() {
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [ex, setEx] = useState<Exercise[]>([]);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<{ ok?: string; err?: string }>({});
  const [showArchived, setShowArchived] = useState(false);
  const [me, setMe] = useState<{ email: string } | null>(null);
  const cats = useCategories();

  const load = useCallback(() => {
    api<Passkey[]>('/api/auth/passkey/list').then(setKeys).catch(() => {});
    api<Exercise[]>('/api/exercises').then(setEx).catch(() => {});
    api<{ email: string }>('/api/auth/me').then(setMe).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function addPasskey() {
    setMsg({});
    try {
      const opts = await api('/api/auth/passkey/register-options');
      const response = await startRegistration({ optionsJSON: opts });
      const ua = navigator.userAgent;
      const name = /Android/.test(ua) ? 'Android' : /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Gerät';
      await api('/api/auth/passkey/register-verify', { method: 'POST', body: { response, name } });
      setMsg({ ok: 'Biometrische Anmeldung ist eingerichtet. Ab jetzt kannst du dich damit anmelden.' });
      load();
    } catch (e: any) {
      setMsg({ err: e?.name === 'NotAllowedError' ? 'Abgebrochen.' : e.message });
    }
  }

  async function removePasskey(id: string) {
    await api('/api/auth/passkey/list', { method: 'DELETE', body: { id } });
    load();
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg({});
    try {
      await api('/api/auth/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      setPwMsg({ ok: 'Passwort geändert.' });
    } catch (e: any) { setPwMsg({ err: e.message }); }
  }

  async function patchEx(id: number, body: Partial<Exercise>) {
    try { await api(`/api/exercises/${id}`, { method: 'PATCH', body }); } catch (e: any) { alert(e.message); }
    load();
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const visible = ex.filter((e) => showArchived || !e.archived);

  return (
    <>
      <div className="topbar"><h1 className="title">Mehr</h1></div>
      <InstallCard />

      <div className="label">Konto</div>
      <div className="card row">
        <span className="muted small">Angemeldet als</span>
        <b style={{ marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.email ?? '…'}</b>
      </div>

      <div className="label">Anmeldung</div>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <IconFace />
          <b>Fingerabdruck / Face ID</b>
        </div>
        {keys.length === 0 && <p className="muted small" style={{ marginTop: 0 }}>Noch nicht eingerichtet. Richte es auf deinem Handy ein (Android: Fingerabdruck oder Displaysperre, iPhone: Face ID), dann brauchst du kein Passwort mehr.</p>}
        {keys.map((k) => (
          <div key={k.id} className="row small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
            <span>{k.device_name}</span>
            <span className="faint">seit {fmtShort(k.created_at.slice(0, 10))}</span>
            <button className="faint" style={{ marginLeft: 'auto' }} onClick={() => removePasskey(k.id)}>Entfernen</button>
          </div>
        ))}
        <button className="btn full" style={{ marginTop: 10 }} onClick={addPasskey}>Auf diesem Gerät einrichten</button>
        {msg.ok && <p className="okmsg">{msg.ok}</p>}
        {msg.err && <p className="err">{msg.err}</p>}
      </div>

      <form className="card" onSubmit={changePw}>
        <b style={{ display: 'block', marginBottom: 10 }}>Passwort ändern</b>
        <input className="field" type="password" placeholder="Aktuelles Passwort" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input className="field" type="password" placeholder="Neues Passwort (mind. 8 Zeichen)" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button className="btn full" type="submit">Speichern</button>
        {pwMsg.ok && <p className="okmsg">{pwMsg.ok}</p>}
        {pwMsg.err && <p className="err">{pwMsg.err}</p>}
      </form>

      <div className="label">Verknüpfungen</div>
      <WatchCard />
      <StravaCard />

      <div className="label">Kategorien</div>
      <CategoryManager onChange={load} />

      <div className="label">Übungen verwalten</div>
      <div className="card">
        <p className="muted small" style={{ marginTop: 0 }}>★ = Standardübung (im Fortschritt hervorgehoben). Außerdem Kategorie ändern, umbenennen oder ausblenden – ausgeblendete Übungen bleiben im Verlauf erhalten.</p>
        {visible.map((e) => (
          <div key={e.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)', opacity: e.archived ? 0.5 : 1 }}>
            <input
              className="field"
              style={{ marginBottom: 6, height: 42 }}
              defaultValue={e.name}
              onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== e.name && patchEx(e.id, { name: ev.target.value.trim() })}
            />
            <div className="row">
              <button className={`star ${e.favorite ? 'on' : ''}`} onClick={() => patchEx(e.id, { favorite: !e.favorite })} aria-label="Standardübung">★</button>
              <select className="field" style={{ marginBottom: 0, height: 40, flex: 1 }} value={e.category_id} onChange={(ev) => patchEx(e.id, { categoryId: Number(ev.target.value) } as any)}>
                {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="faint small tnum" style={{ minWidth: 34, textAlign: 'right' }}>{e.uses}×</span>
              <button className="btn" style={{ height: 40, fontSize: 14 }} onClick={() => patchEx(e.id, { archived: !e.archived })}>{e.archived ? 'Einblenden' : 'Ausblenden'}</button>
            </div>
          </div>
        ))}
        <button className="faint small" style={{ marginTop: 8 }} onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Ausgeblendete verbergen' : 'Ausgeblendete anzeigen'}</button>
      </div>

      <div className="label">Daten</div>
      <a className="card row" href="/api/export"><span>Alle Daten als CSV exportieren</span><span className="faint" style={{ marginLeft: 'auto' }}>Excel-kompatibel</span></a>
      <button className="card" style={{ width: '100%', textAlign: 'left', color: 'var(--danger)' }} onClick={logout}>Abmelden</button>
    </>
  );
}
