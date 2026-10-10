'use client';
import { useMemo, useState } from 'react';
import Sheet from './Sheet';
import { CAT_COLOR, fmtShort } from '@/lib/format';
import type { Exercise } from './types';

export default function ExercisePicker({ category, exercises, onPick, onCreate, onClose }: {
  category: string;
  exercises: Exercise[];
  onPick: (ex: Exercise) => void;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const query = q.trim().toLowerCase();

  const own = useMemo(
    () => exercises.filter((e) => !e.archived && e.category === category && (!query || e.name.toLowerCase().includes(query))),
    [exercises, category, query],
  );
  const other = useMemo(
    () => (query ? exercises.filter((e) => !e.archived && e.category !== category && e.name.toLowerCase().includes(query)) : []),
    [exercises, category, query],
  );
  const exact = exercises.some((e) => e.name.toLowerCase() === query);

  const row = (e: Exercise) => (
    <button key={e.id} className="pick" onClick={() => onPick(e)}>
      <span className="pick-name">{e.name}{e.favorite && <span className="star-inline"> ★</span>}</span>
      <span className="pick-meta tnum">
        {e.uses > 0 ? `${e.uses}×` : 'neu'}
        {e.last_date && <><br />{fmtShort(e.last_date)}</>}
      </span>
    </button>
  );

  return (
    <Sheet
      onClose={onClose}
      title={<><span className="cat-dot" style={{ background: CAT_COLOR[category] }} />{category}</>}
    >
      <input
        className="search"
        placeholder="Übung suchen oder neu anlegen …"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        enterKeyHint="done"
      />
      {query && !exact && (
        <button
          className="newbtn"
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onCreate(q.trim()); } finally { setBusy(false); } }}
        >
          <b>+ Neue Übung:</b> „{q.trim()}“ in {category}
        </button>
      )}
      {!query && <button className="newbtn" onClick={() => (document.querySelector('.search') as HTMLInputElement)?.focus()}><b>+</b> Neue Übung hinzufügen</button>}
      {own.map(row)}
      {own.length === 0 && !query && <p className="muted small">Noch keine Übungen in dieser Kategorie.</p>}
      {other.length > 0 && (
        <>
          <div className="label">Andere Kategorien</div>
          {other.map(row)}
        </>
      )}
    </Sheet>
  );
}
