'use client';
import { useEffect, useState } from 'react';
import { api } from './format';

export type Category = { id: number; name: string; color: string; position: number; exercises: number };

let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;
const subs = new Set<(c: Category[]) => void>();

export function loadCategories(force = false): Promise<Category[]> {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight || force) {
    inflight = api<Category[]>('/api/categories').then((c) => {
      cache = c;
      subs.forEach((s) => s(c));
      inflight = null;
      return c;
    });
  }
  return inflight;
}

/** Kategorien des angemeldeten Kontos (geteilt zwischen allen Ansichten). */
export function useCategories() {
  const [cats, setCats] = useState<Category[] | null>(cache);
  useEffect(() => {
    subs.add(setCats);
    loadCategories().then(setCats).catch(() => {});
    return () => { subs.delete(setCats); };
  }, []);
  return cats;
}

export const refreshCategories = () => loadCategories(true);
