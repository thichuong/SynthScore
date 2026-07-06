import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Đăng ký Service Worker cho PWA chạy offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        console.log('PWA Service Worker registered scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration failed:', err);
      });
  });
}

createApp(App).mount('#app')
