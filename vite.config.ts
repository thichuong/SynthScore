import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-osmd',
              test: /[\\/]node_modules[\\/]opensheetmusicdisplay[\\/]/,
            },
            {
              name: 'vendor-abcjs',
              test: /[\\/]node_modules[\\/]abcjs[\\/]/,
            },
            {
              name: 'vendor-audio',
              test: /[\\/]node_modules[\\/](spessasynth_lib|@tonejs)[\\/]/,
            },
            {
              name: 'vendor-core',
              test: /[\\/]node_modules[\\/]/,
            }
          ]
        }
      }
    }
  },
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
