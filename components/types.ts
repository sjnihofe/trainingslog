import type { WSet } from '@/lib/format';

export type Exercise = { id: number; name: string; category_id: number; category: string; color: string; archived: boolean; favorite: boolean; uses: number; last_date: string | null };
export type Entry = { id: number; exercise_id: number; name: string; category_id: number; category: string; color: string; sets: WSet[] };
