'use client';
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { IconTrash, IconX } from './Icons';
import { api, CAT_COLOR, fmtSets, fmtShort, num, type WSet } from '@/lib/format';
import type { Entry, Exercise } from './types';

type Row = { reps: string; weight: string };

const toRows = (sets: WSet[]): Row[] => sets.map((s) => ({ reps: s.reps === null ? '' : String(s.reps), weight: s.weight === null ? '' : num(s.weight) }));
const parseW = (s: string) => { const v = Number(s.replace(',', '.')); return s.trim() === '' || !Number.isFinite(v) ? null : v; };
const parseR = (s: string) => { const v = parseInt(s, 10); return Number.isFinite(v) ? v : null; };

export default function EntryEditor({ date, exercise, entry, onClose, onSaved }: {
  date: string;
  exercise: Pick<Exercise, 'id' | 'name' | 'category'>;
  entry?: Entry;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(entry ? toRows(entry.sets) : null);
  const [bw, setBw] = useState<boolean>(entry ? entry.sets.every((s) => s.bodyweight) : false);
  const [last, setLast] = useState<{ date: string; sets: WSet[] } | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api(`/api/exercises/${exercise.id}/history?before=${date}`).then((d) => {
      if (!alive) return;
      const sessions: { date: string; sets: WSet[] }[] = d.sessions;
      const l = sessions[0] ?? null;
      setLast(l);
      const ws = sessions.flatMap((s) => s.sets.map((x) => (x.bodyweight ? null : x.weight))).filter((x): x is number => x !== null);
      setBest(ws.length ? Math.max(...ws) : null);
      if (!entry) {
        if (l && l.sets.length) {
          setRows(toRows(l.sets.map((s) => ({ ...s, reps: s.reps ?? 8 }))));
          setBw(l.sets.every((s) => s.bodyweight));
        } else {
          setRows([{ reps: '8', weight: '' }, { reps: '8', weight: '' }]);
        }
      }
    }).catch(() => { if (!entry) setRows([{ reps: '8', weight: '' }, { reps: '8', weight: '' }]); });
    return () => { alive = false; };
  }, [exercise.id, date, entry]);

  const upd = (i: number, patch: Partial<Row>) => setRows((r) => r!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const stepR = (i: number, d: number) => upd(i, { reps: String(Math.max(0, (parseR(rows![i].reps) ?? 0) + d)) });
  const stepW = (i: number, d: number) => upd(i, { weight: num(Math.max(0, (parseW(rows![i].weight) ?? 0) + d)) });

  async function save() {
    if (!rows) return;
    const sets = rows.map((r) => ({ reps: parseR(r.reps), weight: bw ? null : parseW(r.weight), bodyweight: bw }));
    if (!sets.some((s) => s.reps !== null || s.weight !== null || s.bodyweight)) { setErr('Bitte mindestens einen Satz ausfüllen'); return; }
    setBusy(true); setErr('');
    try {
      if (entry) await api(`/api/entries/${entry.id}`, { method: 'PUT', body: { sets } });
      else await api('/api/entries', { method: 'POST', body: { date, exerciseId: exercise.id, sets } });
      const top = Math.max(...sets.map((s) => s.weight ?? 0));
      onSaved(!bw && best !== null && top > best ? `Neuer Rekord: ${num(top)} kg` : 'Gespeichert');
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  async function remove() {
    if (!entry) return;
    setBusy(true);
    try { await api(`/api/entries/${entry.id}`, { method: 'DELETE' }); onSaved('Gelöscht'); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <Sheet
      onClose={onClose}
      title={<><span className="cat-dot" style={{ background: CAT_COLOR[exercise.category] }} />{exercise.name}</>}
      footer={
        <>
          {entry && <button className="btn danger" onClick={remove} disabled={busy} aria-label="Löschen"><IconTrash /></button>}
          <button className="btn primary" onClick={save} disabled={busy || !rows}>{busy ? 'Speichert …' : 'Speichern'}</button>
        </>
      }
    >
      {last ? (
        <div className="last tnum">Letztes Mal · {fmtShort(last.date)}: <b>{fmtSets(last.sets)}</b>{best !== null && <> · Bestwert {num(best)} kg</>}</div>
      ) : (
        <div className="last">Erstes Mal – viel Erfolg!</div>
      )}

      <div className="toggle">
        <span>Nur Körpergewicht</span>
        <button className={`switch ${bw ? 'on' : ''}`} onClick={() => setBw(!bw)} aria-pressed={bw} aria-label="Nur Körpergewicht" />
      </div>

      <div className={`colhead ${bw ? 'bw' : ''}`}>
        <span>#</span><span>Wdh</span>{!bw && <span>Gewicht</span>}<span />
      </div>
      {rows?.map((r, i) => (
        <div key={i} className={`setrow ${bw ? 'bw' : ''}`}>
          <div className="setno tnum">{i + 1}</div>
          <div className="stepper">
            <button onClick={() => stepR(i, -1)} aria-label="Weniger Wiederholungen">−</button>
            <input inputMode="numeric" value={r.reps} onChange={(e) => upd(i, { reps: e.target.value.replace(/[^0-9]/g, '') })} onFocus={(e) => e.target.select()} />
            <button onClick={() => stepR(i, 1)} aria-label="Mehr Wiederholungen">+</button>
          </div>
          {!bw && (
            <div className="stepper">
              <button onClick={() => stepW(i, -2.5)} aria-label="Weniger Gewicht">−</button>
              <input inputMode="decimal" placeholder="kg" value={r.weight} onChange={(e) => upd(i, { weight: e.target.value.replace(/[^0-9.,]/g, '') })} onFocus={(e) => e.target.select()} />
              <button onClick={() => stepW(i, 2.5)} aria-label="Mehr Gewicht">+</button>
            </div>
          )}
          <button className="del" onClick={() => setRows((x) => x!.filter((_, j) => j !== i))} disabled={rows.length <= 1} aria-label="Satz entfernen"><IconX /></button>
        </div>
      ))}
      {rows && <button className="addset" onClick={() => setRows((x) => [...x!, { ...x![x!.length - 1] }])}>+ Satz hinzufügen</button>}
      {!bw && <p className="faint small">Gewicht-Tasten ändern in 2,5-kg-Schritten. Du kannst jeden Wert auch direkt eintippen.</p>}
      {err && <p className="err">{err}</p>}
    </Sheet>
  );
}
