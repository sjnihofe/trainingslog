'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import EntryEditor from './EntryEditor';
import ExercisePicker from './ExercisePicker';
import { IconLeft, IconPlus, IconRight } from './Icons';
import { addDays, api, CAT_COLOR, CATS, fmtDate, fmtSets, todayISO } from '@/lib/format';
import type { Entry, Exercise } from './types';
import { setSwipeDir, takeSwipeDir, useSwipe } from './useSwipe';

type Sheet = null | { kind: 'pick'; category: string } | { kind: 'edit'; exercise: Pick<Exercise, 'id' | 'name' | 'category'>; entry?: Entry };

export default function DayView({ date }: { date: string }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState('');
  const today = todayISO();

  const load = useCallback(async () => {
    const [day, ex] = await Promise.all([api(`/api/day/${date}`), api<Exercise[]>('/api/exercises')]);
    setEntries(day.entries);
    setNote(day.note ?? '');
    setSavedNote(day.note ?? '');
    setExercises(ex);
  }, [date]);

  useEffect(() => { setEntries(null); load().catch(() => setEntries([])); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  // Android-Zurück-Taste / Zurück-Geste schließt das offene Sheet statt die Seite zu verlassen
  const sheetOpen = sheet !== null;
  const closedByBack = useRef(false);
  useEffect(() => {
    if (!sheetOpen) return;
    window.history.pushState({ ...window.history.state, tlSheet: true }, '');
    const onPop = () => { closedByBack.current = true; setSheet(null); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!closedByBack.current && window.history.state?.tlSheet) window.history.back();
      closedByBack.current = false;
    };
  }, [sheetOpen]);

  const go = (d: string) => router.push(`/tag/${d}`);
  // Wischen: links = nächster Tag, rechts = vorheriger Tag
  const swipeRef = useSwipe<HTMLDivElement>((dir) => {
    setSwipeDir(dir);
    router.replace(`/tag/${addDays(date, dir)}`);
  });
  const [enter] = useState(() => takeSwipeDir());
  const closeSheet = useCallback(() => setSheet(null), []);

  async function saveNote() {
    if (note.trim() === savedNote.trim()) return;
    await api(`/api/day/${date}`, { method: 'PUT', body: { note } });
    setSavedNote(note);
    setToast('Notiz gespeichert');
  }

  const total = entries?.length ?? 0;

  return (
    <>
      <div ref={swipeRef} className={`swipe-area ${enter === 1 ? 'enter-right' : enter === -1 ? 'enter-left' : ''}`}>
      <div className="topbar">
        <div>
          <div className="subtitle">{date === today ? 'Heute' : date < today ? 'Nachtragen' : 'Geplant'}</div>
          <h1 className="title">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
        </div>
        {total > 0 && <span className="pill accent tnum">{total} {total === 1 ? 'Übung' : 'Übungen'}</span>}
      </div>

      <div className="datebar">
        <button className="iconbtn" onClick={() => go(addDays(date, -1))} aria-label="Vorheriger Tag"><IconLeft /></button>
        <label className="datepick tnum">
          {fmtDate(date)}
          <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Datum wählen" />
        </label>
        {date !== today ? (
          <button className="iconbtn" style={{ width: 'auto', padding: '0 12px', fontWeight: 650, fontSize: 14 }} onClick={() => go(today)}>Heute</button>
        ) : (
          <button className="iconbtn" onClick={() => go(addDays(date, 1))} aria-label="Nächster Tag"><IconRight /></button>
        )}
      </div>

      {entries === null
        ? CATS.map((c) => <div key={c} className="skeleton" />)
        : CATS.map((cat) => {
            const list = entries.filter((e) => e.category === cat);
            return (
              <section key={cat} className="cat">
                <button className="cat-head" onClick={() => setSheet({ kind: 'pick', category: cat })}>
                  <span className="cat-dot" style={{ background: CAT_COLOR[cat] }} />
                  <span className="cat-name">{cat}</span>
                  {list.length === 0 && <span className="cat-empty">Übung wählen</span>}
                  <span className="cat-add"><IconPlus /></span>
                </button>
                {list.map((e) => (
                  <button key={e.id} className="entry" onClick={() => setSheet({ kind: 'edit', exercise: { id: e.exercise_id, name: e.name, category: e.category }, entry: e })}>
                    <div>
                      <div className="entry-name">{e.name}</div>
                      <div className="entry-sets tnum">{fmtSets(e.sets)}</div>
                    </div>
                    <span className="chev"><IconRight /></span>
                  </button>
                ))}
              </section>
            );
          })}
      </div>

      <div className="label">Notiz</div>
      <textarea
        className="note"
        rows={2}
        placeholder="z. B. EGYM, wenig Schlaf, Schulter zwickt …"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
      />

      {sheet?.kind === 'pick' && (
        <ExercisePicker
          category={sheet.category}
          exercises={exercises}
          onClose={closeSheet}
          onPick={(ex) => setSheet({ kind: 'edit', exercise: ex })}
          onCreate={async (name) => {
            const ex = await api<Exercise>('/api/exercises', { method: 'POST', body: { name, category: sheet.category } });
            setExercises((xs) => [...xs.filter((x) => x.id !== ex.id), ex]);
            setSheet({ kind: 'edit', exercise: ex });
          }}
        />
      )}
      {sheet?.kind === 'edit' && (
        <EntryEditor
          date={date}
          exercise={sheet.exercise}
          entry={sheet.entry}
          onClose={closeSheet}
          onSaved={(msg) => { setSheet(null); setToast(msg); load(); }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
