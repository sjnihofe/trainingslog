'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtShort } from '@/lib/format';
import { useCategories } from '@/lib/useCategories';
import type { Exercise } from '@/components/types';
import { IconRight } from '@/components/Icons';

// 'standard' | 'alle' | 'c<Kategorie-ID>'
type Filter = string;
const KEY = 'tl_progress_filter';

export default function Fortschritt() {
  const cats = useCategories();
  const [ex, setEx] = useState<Exercise[] | null>(null);
  const [filter, setFilterState] = useState<Filter>('standard');

  useEffect(() => {
    try { const f = localStorage.getItem(KEY); if (f) setFilterState(f); } catch {}
    api<Exercise[]>('/api/exercises').then(setEx).catch(() => setEx([]));
  }, []);
  const setFilter = (f: Filter) => { setFilterState(f); try { localStorage.setItem(KEY, f); } catch {} };

  // Gespeicherter Filter auf eine gelöschte Kategorie → zurück auf Standard
  const catFilter = filter.startsWith('c') ? Number(filter.slice(1)) : null;
  const effective = catFilter !== null && cats && !cats.some((c) => c.id === catFilter) ? 'standard' : filter;

  const visible = (ex ?? []).filter((e) => e.uses > 0 && !e.archived && (
    effective === 'alle' ? true : effective === 'standard' ? e.favorite : e.category_id === catFilter));
  const favCount = (ex ?? []).filter((e) => e.favorite && e.uses > 0).length;

  return (
    <>
      <div className="topbar"><h1 className="title">Fortschritt</h1></div>
      <div className="chips" role="tablist">
        <button className={`chip ${effective === 'standard' ? 'on' : ''}`} onClick={() => setFilter('standard')}>★ Standard</button>
        <button className={`chip ${effective === 'alle' ? 'on' : ''}`} onClick={() => setFilter('alle')}>Alle</button>
        {cats?.map((c) => (
          <button key={c.id} className={`chip ${effective === `c${c.id}` ? 'on' : ''}`} onClick={() => setFilter(`c${c.id}`)}>
            <span className="cat-dot" style={{ background: c.color }} />{c.name}
          </button>
        ))}
      </div>
      {(!ex || !cats) && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}
      {ex && effective === 'standard' && favCount === 0 && (
        <p className="muted small">Noch keine Standardübungen mit Einträgen. Markiere Übungen mit ★ – in der Detailansicht oder unter „Mehr“.</p>
      )}
      {ex && cats?.map((cat) => {
        const list = visible.filter((e) => e.category_id === cat.id).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.uses - a.uses);
        if (!list.length) return null;
        return (
          <section key={cat.id} className="cat">
            <div className="cat-head">
              <span className="cat-dot" style={{ background: cat.color }} />
              <span className="cat-name">{cat.name}</span>
            </div>
            {list.map((e) => (
              <Link key={e.id} href={`/fortschritt/${e.id}`} className="entry">
                <div>
                  <div className="entry-name">{e.name}{e.favorite && effective !== 'standard' && <span className="star-inline"> ★</span>}</div>
                  <div className="entry-sets tnum">{e.uses} {e.uses === 1 ? 'Einheit' : 'Einheiten'} · zuletzt {fmtShort(e.last_date)}</div>
                </div>
                <span className="chev"><IconRight /></span>
              </Link>
            ))}
          </section>
        );
      })}
    </>
  );
}
