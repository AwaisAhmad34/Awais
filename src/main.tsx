import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline asset & app-shell caching across intermittent campus networks
registerSW({
  immediate: true,
  onRegisteredSW(swUrl) {
    window.__APLUS_SW_READY__ = Boolean(swUrl);
  },
  onOfflineReady() {
    window.__APLUS_SW_READY__ = true;
  },
});

createRoot(document.getElementById('root')!).render(<App />);
