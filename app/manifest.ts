import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trainingslog',
    short_name: 'Training',
    id: '/',
    start_url: '/',
    scope: '/',
    orientation: 'portrait',
    display: 'standalone',
    background_color: '#0e1013',
    theme_color: '#0e1013',
    lang: 'de',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
