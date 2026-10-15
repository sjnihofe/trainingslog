import Link from 'next/link';
import { fmtDate, fmtSets, type HealthW, type WSet } from '@/lib/format';
import { HealthLine } from './HealthStats';

export type Workout = { date: string; note: string | null; entries: { name: string; category: string; category_id?: number; color?: string; sets: WSet[] }[]; health?: HealthW[] };

export default function WorkoutCard({ w }: { w: Workout }) {
  return (
    <Link href={`/tag/${w.date}`} className="card">
      <div className="row" style={{ marginBottom: 6 }}>
        <b>{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
        <span className="faint small" style={{ marginLeft: 'auto' }}>
          {w.entries.length ? `${w.entries.length} ${w.entries.length === 1 ? 'Übung' : 'Übungen'}` : w.health?.length ? 'Apple Watch' : ''}
        </span>
      </div>
      {w.entries.map((e, i) => (
        <div key={i} className="line-item">
          <span className="dot" style={{ background: e.color ?? 'var(--faint)' }} />
          <span>{e.name}</span>
          <span className="muted tnum" style={{ marginLeft: 'auto', textAlign: 'right' }}>{fmtSets(e.sets)}</span>
        </div>
      ))}
      {w.note && <div className="muted small" style={{ marginTop: 4 }}>{w.note}</div>}
      {w.health?.map((h) => <HealthLine key={h.id} h={h} />)}
    </Link>
  );
}
