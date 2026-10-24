'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fmtDate, fmtSets, type HealthW, type WSet } from '@/lib/format';
import { HealthLine } from './HealthStats';
import { IconTrash } from './Icons';

export type WorkoutEntry = { id?: number; name: string; category: string; category_id?: number; color?: string; sets: WSet[] };
export type Workout = { date: string; note: string | null; entries: WorkoutEntry[]; health?: HealthW[] };

// onRemove gesetzt → Karte bekommt "Bearbeiten", darin lassen sich ganze Übungen entfernen
export default function WorkoutCard({ w, onRemove }: { w: Workout; onRemove?: (e: WorkoutEntry) => void }) {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const canEdit = !!onRemove && w.entries.some((e) => e.id !== undefined);
  const editing = edit && canEdit;

  const body = (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <b>{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
        <span className="faint small" style={{ marginLeft: 'auto' }}>
          {w.entries.length ? `${w.entries.length} ${w.entries.length === 1 ? 'Übung' : 'Übungen'}` : w.health?.length ? 'Apple Watch' : ''}
        </span>
        {canEdit && (
          <button
            className="card-head-btn"
            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setEdit(!editing); setConfirm(null); }}
          >{editing ? 'Fertig' : 'Bearbeiten'}</button>
        )}
      </div>
      {w.entries.map((e, i) => confirm !== null && e.id === confirm ? (
        <div key={e.id} className="line-item line-confirm">
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }}>„{e.name}“ entfernen?</span>
          <button className="mini" onClick={() => setConfirm(null)}>Abbrechen</button>
          <button className="mini danger" onClick={() => { setConfirm(null); onRemove!(e); }}>Entfernen</button>
        </div>
      ) : (
        <div key={e.id ?? i} className="line-item">
          <span className="dot" style={{ background: e.color ?? 'var(--faint)' }} />
          <span>{e.name}</span>
          <span className="muted tnum" style={{ marginLeft: 'auto', textAlign: 'right' }}>{fmtSets(e.sets)}</span>
          {editing && e.id !== undefined && (
            <button className="line-del" onClick={() => setConfirm(e.id!)} aria-label={`${e.name} aus dem Training entfernen`}><IconTrash /></button>
          )}
        </div>
      ))}
      {w.note && <div className="muted small" style={{ marginTop: 4 }}>{w.note}</div>}
      {w.health?.map((h) => <HealthLine key={h.id} h={h} />)}
      {editing && <Link href={`/tag/${w.date}`} className="small" style={{ display: 'block', marginTop: 8, color: 'var(--accent)', fontWeight: 650 }}>Sätze bearbeiten →</Link>}
    </>
  );

  return editing ? <div className="card editing">{body}</div> : <Link href={`/tag/${w.date}`} className="card">{body}</Link>;
}
