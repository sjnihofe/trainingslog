'use client';
import { num } from '@/lib/format';
import { FIT, type FitPoint } from '@/lib/progress';

const STATE: Record<string, { label: string; cls: string; arrow: string }> = {
  steigend: { label: 'Du verbesserst dich', cls: 'up', arrow: '▲' },
  fallend: { label: 'Leicht rückläufig', cls: 'down', arrow: '▼' },
  stabil: { label: 'Stabil', cls: 'flat', arrow: '▶' },
  neu: { label: 'Noch zu wenig Verlauf', cls: 'flat', arrow: '•' },
};

export default function FitnessCard({ timeline, trend }: {
  timeline: FitPoint[];
  trend: { current: FitPoint; ref: FitPoint | null; delta: number | null; state: 'steigend' | 'fallend' | 'stabil' | 'neu' } | null;
}) {
  if (!trend) {
    return (
      <div className="card fit-card">
        <div className="fit-label">Fitnessniveau</div>
        <p className="muted small" style={{ margin: '6px 0 0' }}>Sobald eine Übung mindestens zweimal in den letzten 6 Wochen trainiert wurde, erscheint hier dein Fitnessniveau.</p>
      </div>
    );
  }
  const st = STATE[trend.state];
  const spark = timeline.slice(-26);
  const W = 120, H = 36;
  const vs = spark.map((p) => p.value);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const sx = (i: number) => (spark.length < 2 ? W / 2 : (i / (spark.length - 1)) * W);
  const sy = (v: number) => H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 6);
  const c = trend.current;
  return (
    <div className="card fit-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="fit-label">Fitnessniveau <span className="fit-hint">100 = dein Start</span></div>
          <div className="fit-value tnum">{num(Math.round(c.value))}</div>
          <div className={`fit-trend ${st.cls}`}>
            {st.arrow} {trend.delta !== null ? `${trend.delta > 0 ? '+' : ''}${num(trend.delta)} in 4 Wochen · ` : ''}{st.label}
          </div>
        </div>
        {spark.length > 1 && (
          <svg className="fit-spark" viewBox={`0 0 ${W} ${H}`} aria-label="Verlauf der letzten 6 Monate">
            <path d={spark.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
            <circle cx={sx(spark.length - 1)} cy={sy(c.value)} r="3" fill="var(--accent)" />
          </svg>
        )}
      </div>
      <div className="fit-parts tnum">
        <span><b>{num(Math.round(c.strength))} %</b> Kraft</span>
        <span><b>{c.activity} %</b> Aktivität</span>
        <span><b>{c.exercises}</b> {c.exercises === 1 ? 'Übung' : 'Übungen'} aktiv</span>
      </div>
      <details className="howto">
        <summary>Wie wird das berechnet?</summary>
        <p className="muted small">
          <b>Kraft:</b> Für jede Übung, die du in den letzten {FIT.recentDays / 7} Wochen trainiert hast, wird deine letzte Einheit mit deiner allerersten verglichen
          (geschätztes Maximalgewicht für 1 Wiederholung, bei Körpergewicht-Übungen die Wiederholungen). Übungen, die du oft machst, zählen stärker. 100 % = dein Startniveau.
        </p>
        <p className="muted small">
          <b>Aktivität:</b> Trainingstage der letzten 4 Wochen (Kraft, Laufen, Apple Watch) im Verhältnis zum Ziel von {FIT.targetPerWeek}× pro Woche.
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>
          <b>Fitnessniveau</b> = Kraft × (0,7 + 0,3 × Aktivität). Wer regelmäßig trainiert, behält den vollen Kraftwert; längere Pausen senken das Niveau um bis zu 30 %.
          Der Trend vergleicht mit dem Wert vor 4 Wochen (ab ±2 Punkten „steigend“ bzw. „rückläufig“).
        </p>
      </details>
    </div>
  );
}
