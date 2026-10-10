'use client';
// Fängt das Installations-Angebot von Chrome/Android ab, damit wir es per Knopf auslösen können.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: BIPEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export const canInstall = () => deferred !== null;
export const wasInstalled = () => installed;
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  if (outcome === 'accepted') installed = true;
  notify();
  return outcome === 'accepted';
}

export function onInstallChange(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
