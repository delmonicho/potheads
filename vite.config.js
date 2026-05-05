import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/auth/callback': {
        target: 'https://kkagpnsekzsupwswnryo.supabase.co',
        changeOrigin: true,
        rewrite: path => path.replace('/auth/callback', '/auth/v1/callback')
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Pottery Tracker',
        short_name: 'Pottery',
        description: 'Track your pottery pieces through every stage',
        theme_color: '#78350f',
        background_color: '#fafaf9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: 'https://pot-heads.studio/',
        scope: 'https://pot-heads.studio/',
        id: 'https://pot-heads.studio/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
