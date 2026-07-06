import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: '/SynthScore/',
  plugins: [vue()],
  server: {
    proxy: {
      '/github-releases': {
        target: 'https://github.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/github-releases/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            proxyRes.headers['access-control-allow-origin'] = '*';
          });
        }
      },
      '/raw-github': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/raw-github/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            proxyRes.headers['access-control-allow-origin'] = '*';
          });
        }
      }
    }
  }
})
