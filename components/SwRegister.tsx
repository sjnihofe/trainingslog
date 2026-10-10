'use client';
import { useEffect } from 'react';
import '@/lib/install'; // früh laden, damit das Installations-Angebot nicht verpasst wird

export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
