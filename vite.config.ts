import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const suppressViteHmrPlugin = () => ({
  name: 'suppress-vite-hmr',
  transformIndexHtml: {
    order: 'pre' as const,
    handler() {
      return [
        {
          tag: 'script',
          attrs: { type: 'text/javascript' },
          injectTo: 'head-prepend' as const,
          children: `(function(){if(typeof window==="undefined")return;var O=window.WebSocket;if(!O)return;function D(u,p){this.url=String(u||"");this.protocol=p||"vite-hmr";this.readyState=1;this.bufferedAmount=0;this.binaryType="blob";this._l={};var s=this;setTimeout(function(){s._e("open",new Event("open"))},0)}D.prototype.addEventListener=function(t,l,o){if(!this._l[t])this._l[t]=[];this._l[t].push({fn:l,once:!!(o&&o.once)})};D.prototype.removeEventListener=function(t,l){if(!this._l[t])return;this._l[t]=this._l[t].filter(function(i){return i.fn!==l})};D.prototype.dispatchEvent=function(e){this._e(e.type,e);return true};D.prototype._e=function(t,e){var a=(this._l[t]||[]).slice();for(var i=0;i<a.length;i++){if(a[i].once)this.removeEventListener(t,a[i].fn);try{if(typeof a[i].fn==="function")a[i].fn.call(this,e);else if(a[i].fn&&typeof a[i].fn.handleEvent==="function")a[i].fn.handleEvent(e)}catch(err){}}if(typeof this["on"+t]==="function"){try{this["on"+t](e)}catch(err){}}};D.prototype.send=function(){};D.prototype.close=function(){this.readyState=3;var c=typeof CloseEvent!=="undefined"?new CloseEvent("close",{wasClean:true,code:1000}):new Event("close");this._e("close",c)};D.CONNECTING=0;D.OPEN=1;D.CLOSING=2;D.CLOSED=3;window.WebSocket=function(u,p){var isHmr=p==="vite-hmr"||(Array.isArray(p)&&p.indexOf("vite-hmr")!==-1)||(typeof u==="string"&&(u.indexOf("vite-hmr")!==-1||u.indexOf("token=")!==-1));if(isHmr){return new D(u,p)}return p!==undefined?new O(u,p):new O(u)};window.WebSocket.prototype=O.prototype;window.WebSocket.CONNECTING=0;window.WebSocket.OPEN=1;window.WebSocket.CLOSING=2;window.WebSocket.CLOSED=3;})();`,
        },
      ];
    },
  },
});

export default defineConfig(() => {
  return {
    plugins: [
      suppressViteHmrPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Multi-Campus Voucher & Petty Cash Management System',
          short_name: 'AplusERP',
          description:
            'Offline-first Multi-Campus Voucher, Petty Cash & 360° School ERP System with IndexedDB & Service Worker caching.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
