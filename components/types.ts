import type { WSet } from '@/lib/format';

export type Exercise = { id: number; name: string; category: string; archived: boolean; uses: number; last_date: string | null };
export type Entry = { id: number; exercise_id: number; name: string; category: string; sets: WSet[] };
