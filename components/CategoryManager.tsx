'use client';
import { useState } from 'react';
import { api } from '@/lib/format';
import { refreshCategories, useCategories, type Category } from '@/lib/useCategories';

const COLORS = ['#ffb020', '#3fb8ff', '#ff6fae', '#a98bff', '#3fd6a0', '#ff7a1a', '#f2e14c', '#5ad1e8', '#ff5a5f', '#9bd65a', '#c9a27c', '#8d95a3'];

function ColorPicker({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {COLORS.map((c) => (
        <button key={c} className={`swatch ${c.toLowerCase() === value.toLowerCase() ? 'on' : ''}`} style={{ background: c }} onClick={() => onPick(c)} aria-label={`Farbe ${c}`} />
      ))}
    </div>
  );
}

export default function CategoryManager({ onChange }: { onChange?: () => void }) {
  const cats = useCategories();
  const [open, setOpen] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[5]);
  const [moveTo, setMoveTo] = useState<Record<number, number>>({});
  const [err, setErr] = useState('');

  const done = async () => { await refreshCategories(); onChange?.(); };
  const run = async (fn: () => Promise<unknown>) => { setErr(''); try { await fn(); await done(); } catch (e: any) { setErr(e.message); } };

  const patch = (c: Category, body: Partial<Category>) => run(() => api(`/api/categories/${c.id}`, { method: 'PATCH', body }));
  const move = (i: number, d: -1 | 1) => {
    if (!cats) return;
    const ids = cats.map((c) => c.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api('/api/categories/reorder', { method: 'POST', body: { ids } }));
  };
  const remove = (c: Category) => run(async () => {
    const target = moveTo[c.id] ?? cats?.find((x) => x.id !== c.id)?.id;
    await api(`/api/categories/${c.id}${c.exercises ? `?moveTo=${target}` : ''}`, { method: 'DELETE' });
    setOpen(null);
  });
  const add = () => run(async () => {
    await api('/api/categories', { method: 'POST', body: { name: newName, color: newColor } });
    setNewName('');
  });

  if (!cats) return <div className="skeleton" />;
  return (
    <div className="card" id="kategorien">
      <p className="muted small" style={{ marginTop: 0 }}>Reihenfolge, Name und Farbe bestimmen, wie die Kategorien beim Training erscheinen.</p>
      {cats.map((c, i) => (
        <div key={c.id} className="catrow">
          <div className="row">
            <button className="cat-dot big" style={{ background: c.color }} onClick={() => setOpen(open === c.id ? null : c.id)} aria-label="Farbe ändern" />
            <input
              className="field catname"
              defaultValue={c.name}
              key={c.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) patch(c, { name: v }); else e.target.value = c.name; }}
              aria-label="Kategoriename"
            />
            <button className="iconbtn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Nach oben">↑</button>
            <button className="iconbtn small" onClick={() => move(i, 1)} disabled={i === cats.length - 1} aria-label="Nach unten">↓</button>
            <button className="iconbtn small" onClick={() => setOpen(open === c.id ? null : c.id)} aria-label="Mehr Optionen">⋯</button>
          </div>
          {open === c.id && (
            <div className="catmore">
              <ColorPicker value={c.color} onPick={(col) => patch(c, { color: col })} />
              <div className="faint small" style={{ margin: '10px 0 6px' }}>{c.exercises} {c.exercises === 1 ? 'Übung' : 'Übungen'} in dieser Kategorie</div>
              {cats.length > 1 && (
                <div className="row">
                  {c.exercises > 0 && (
                    <select className="field" style={{ marginBottom: 0, height: 40, flex: 1 }} value={moveTo[c.id] ?? cats.find((x) => x.id !== c.id)?.id}
                      onChange={(e) => setMoveTo({ ...moveTo, [c.id]: Number(e.target.value) })} aria-label="Übungen verschieben nach">
                      {cats.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>Übungen nach „{x.name}“</option>)}
                    </select>
                  )}
                  <button className="btn danger" style={{ height: 40, fontSize: 14 }} onClick={() => remove(c)}>Löschen</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="catrow" style={{ borderBottom: 0 }}>
        <div className="row">
          <span className="cat-dot big" style={{ background: newColor }} />
          <input className="field catname" placeholder="Neue Kategorie, z. B. Core" value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newName.trim() && add()} />
          <button className="btn primary" style={{ flex: 'none', height: 40, fontSize: 14 }} disabled={!newName.trim()} onClick={add}>Hinzufügen</button>
        </div>
        <ColorPicker value={newColor} onPick={setNewColor} />
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
