'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, CAT_COLOR, CATS, fmtShort } from '@/lib/format';
import type { Exercise } from '@/components/types';
import { IconRight } from '@/components/Icons';

type Filter = 'standard' | 'alle' | (typeof CATS)[number];
const KEY = 'tl_progress_filter';

export default function Fortschritt() {
  const [ex, setEx] = useState<Exercise[] | null>(null);
  const [filter, setFilterState] = useState<Filter>('standard');

  useEffect(() => {
    try { const f = localStorage.getItem(KEY) as Filter | null; if (f) setFilterState(f); } catch {}
    api<Exercise[]>('/api/exercises').then(setEx).catch(() => setEx([]));
  }, []);
  const setFilter = (f: Filter) => { setFilterState(f); try { localStorage.setItem(KEY, f); } catch {} };

  const visible = (ex ?? []).filter((e) => e.uses > 0 && !e.archived && (
    filter === 'alle' ? true : filter === 'standard' ? e.favorite : e.category === filter));
  const favCount = (ex ?? []).filter((e) => e.favorite && e.uses > 0).length;

  return (
    <>
      <div className="topbar"><h1 className="title">Fortschritt</h1></div>
      <div className="chips" role="tablist">
        <button className={`chip ${filter === 'standard' ? 'on' : ''}`} onClick={() => setFilter('standard')}>★ Standard</button>
        <button className={`chip ${filter === 'alle' ? 'on' : ''}`} onClick={() => setFilter('alle')}>Alle</button>
        {CATS.map((c) => (
          <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
            <span className="cat-dot" style={{ background: CAT_COLOR[c] }} />{c}
          </button>
        ))}
      </div>
      {!ex && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}
      {ex && filter === 'standard' && favCount === 0 && (
        <p className="muted small">Noch keine Standardübungen. Markiere Übungen mit ★ – in der Detailansicht oder unter „Mehr“.</p>
      )}
      {ex && CATS.map((cat) => {
        const list = visible.filter((e) => e.category === cat).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.uses - a.uses);
        if (!list.length) return null;
        return (
          <section key={cat} className="cat">
            <div className="cat-head">
              <span className="cat-dot" style={{ background: CAT_COLOR[cat] }} />
              <span className="cat-name">{cat}</span>
            </div>
            {list.map((e) => (
              <Link key={e.id} href={`/fortschritt/${e.id}`} className="entry">
                <div>
                  <div className="entry-name">{e.name}{e.favorite && filter !== 'standard' && <span className="star-inline"> ★</span>}</div>
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
