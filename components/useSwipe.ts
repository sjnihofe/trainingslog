'use client';
import { useEffect, useRef } from 'react';

/**
 * Horizontales Wischen auf einem Element.
 * onSwipe(1) = nach links gewischt (weiter), onSwipe(-1) = nach rechts gewischt (zurück).
 * Vertikales Scrollen bleibt unberührt; Eingabefelder, Sheets und Bildschirmränder
 * (System-Zurück-Geste bei Android/iOS) werden ignoriert.
 */
export function useSwipe<T extends HTMLElement>(onSwipe: (dir: 1 | -1) => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onSwipe);
  cb.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x0 = 0, y0 = 0, dx = 0, active = false;
    let lock: null | 'h' | 'v' = null;

    const reset = () => {
      el.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      el.style.transform = '';
    };
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const edge = 24;
      if (t.clientX < edge || t.clientX > window.innerWidth - edge) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, .sheet, .no-swipe')) return;
      x0 = t.clientX; y0 = t.clientY; dx = 0; lock = null; active = true;
    };
    const move = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
      }
      if (lock === 'h') {
        el.style.transition = 'none';
        el.style.transform = `translateX(${dx * 0.35}px)`;
      }
    };
    const end = () => {
      if (!active) return;
      active = false;
      const fire = lock === 'h' && Math.abs(dx) > 60;
      reset();
      if (fire) cb.current(dx < 0 ? 1 : -1);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  return ref;
}

// Richtung des letzten Wischens – für die Einblend-Animation der neuen Ansicht
let lastDir: 0 | 1 | -1 = 0;
export const setSwipeDir = (d: 0 | 1 | -1) => { lastDir = d; };
export const takeSwipeDir = () => { const d = lastDir; lastDir = 0; return d; };
