import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // IMPORTANTE para GitHub Pages: el repo vive en un subpath
  base: '/CONCRETE2/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Concrete (NSR + ACI)',
        short_name: 'Concrete',
        theme_color: '#111827',
        background_color: '#ffffff',
        display: 'standalone',

        // Ajustados al subpath del repo:
        scope: '/CONCRETE2/',
        start_url: '/CONCRETE2/',

        // Íconos: agrégalos cuando quieras (pwa-192.png / pwa-512.png)
        // icons: [
        //   { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        //   { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        // ],
      },
    }),
  ],
});
