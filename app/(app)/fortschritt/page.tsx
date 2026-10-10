'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, CAT_COLOR, CATS, fmtShort } from '@/lib/format';
import type { Exercise } from '@/components/types';
import { IconRight } from '@/components/Icons';

export default function Fortschritt() {
  const [ex, setEx] = useState<Exercise[] | null>(null);
  useEffect(() => { api<Exercise[]>('/api/exercises').then(setEx).catch(() => setEx([])); }, []);
  return (
    <>
      <div className="topbar"><h1 className="title">Fortschritt</h1></div>
      {!ex && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" />)}
      {ex && CATS.map((cat) => {
        const list = ex.filter((e) => e.category === cat && e.uses > 0).sort((a, b) => b.uses - a.uses);
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
                  <div className="entry-name">{e.name}</div>
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
