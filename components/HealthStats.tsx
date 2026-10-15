import { IconWatch } from './Icons';
import type { HealthW } from '@/lib/format';

export function HealthLine({ h }: { h: HealthW }) {
  const pending = h.hr_count === 0 && h.active_kcal === null;
  return (
    <div className="health-line tnum">
      <span className="health-ico"><IconWatch /></span>
      {h.duration_s ? `${Math.round(h.duration_s / 60)} min` : ''}
      {h.active_kcal !== null && <> · <b>{Math.round(h.active_kcal)}</b> kcal</>}
      {h.avg_hr !== null && <> · Ø <b>{Math.round(h.avg_hr)}</b>{h.max_hr !== null && <>/{Math.round(h.max_hr)}</>} bpm</>}
      {pending && <span className="faint"> · Werte folgen</span>}
    </div>
  );
}

export function HealthCardBody({ h }: { h: HealthW }) {
  const pending = h.hr_count === 0 && h.active_kcal === null;
  return (
    <div className="run-stats tnum">
      <span><b>{h.duration_s ? Math.round(h.duration_s / 60) : '–'}</b><i>Minuten{h.start_estimated ? '*' : ''}</i></span>
      <span><b>{h.active_kcal !== null ? Math.round(h.active_kcal) : '–'}</b><i>kcal aktiv</i></span>
      <span><b>{h.avg_hr !== null ? Math.round(h.avg_hr) : '–'}{h.max_hr !== null ? <small className="faint"> /{Math.round(h.max_hr)}</small> : null}</b><i>Ø / max bpm</i></span>
      {pending && <p className="faint small" style={{ gridColumn: '1 / -1', margin: '4px 0 0' }}>Puls und Kalorien fehlen noch – auf dem iPhone „Trainingswerte senden“ ausführen.</p>}
    </div>
  );
}
