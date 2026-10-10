export type WSet = { reps: number | null; weight: number | null; bodyweight: boolean };

export const CATS = ['Beine', 'Rücken', 'Brust', 'Schulter', 'Sonstiges'] as const;
export type Cat = (typeof CATS)[number];

export const CAT_COLOR: Record<string, string> = {
  Beine: 'var(--c-beine)',
  Rücken: 'var(--c-ruecken)',
  Brust: 'var(--c-brust)',
  Schulter: 'var(--c-schulter)',
  Sonstiges: 'var(--c-sonst)',
};

export function num(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === '') return '';
  const v = Number(n);
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

function one(s: WSet) {
  const r = s.reps ?? '?';
  if (s.bodyweight || s.weight === null) return `${r}`;
  return `${r}×${num(s.weight)}`;
}

// "2 × 8 × 70 kg" bei identischen Sätzen, sonst "8×70 / 6×65 kg"
export function fmtSets(sets: WSet[]) {
  if (!sets?.length) return '';
  const bw = sets.every((s) => s.bodyweight || s.weight === null);
  const same = sets.every((s) => s.reps === sets[0].reps && s.weight === sets[0].weight && s.bodyweight === sets[0].bodyweight);
  if (same && sets.length > 1) {
    return bw ? `${sets.length} × ${sets[0].reps ?? '?'} Wdh` : `${sets.length} × ${sets[0].reps ?? '?'} × ${num(sets[0].weight)} kg`;
  }
  return sets.map(one).join(' / ') + (bw ? ' Wdh' : ' kg');
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('de-DE', { ...opts, timeZone: 'UTC' });
}

export function fmtShort(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400_000);
}

export async function api<T = any>(url: string, init?: RequestInit & { body?: any }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body && typeof init.body !== 'string' ? JSON.stringify(init.body) : init?.body,
  });
  if (res.status === 401 && !url.startsWith('/api/auth')) {
    window.location.href = '/login';
    throw new Error('Nicht angemeldet');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Fehler ${res.status}`);
  return data as T;
}
