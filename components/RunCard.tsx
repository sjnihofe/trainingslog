import Link from 'next/link';
import { fmtDate, fmtDuration, fmtKm, fmtPace, RUN_LABEL, type Run } from '@/lib/format';

export function RunStats({ r }: { r: Run }) {
  return (
    <div className="run-stats tnum">
      <span><b>{fmtKm(r.distance_m)}</b><i>Strecke</i></span>
      <span><b>{fmtDuration(r.moving_time_s)}</b><i>Zeit</i></span>
      <span><b>{fmtPace(r.moving_time_s, r.distance_m)}</b><i>Pace</i></span>
    </div>
  );
}

export default function RunCard({ r, withDate = true }: { r: Run; withDate?: boolean }) {
  return (
    <Link href={`/tag/${r.date}`} className="card run-card">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="run-badge">{RUN_LABEL[r.sport_type] ?? 'Lauf'}</span>
        {withDate && <b>{fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>}
        <span className="faint small" style={{ marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{r.name}</span>
      </div>
      <RunStats r={r} />
    </Link>
  );
}
