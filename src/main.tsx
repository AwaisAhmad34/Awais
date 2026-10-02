import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Suppress harmless [vite] HMR/WebSocket console errors in preview iframe environment
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const first = typeof args[0] === 'string' ? args[0] : '';
  if (
    first.startsWith('[vite]') ||
    first.includes('WebSocket') ||
    first.includes('vite')
  ) {
    return;
  }
  origConsoleError(...args);
};

// Register Service Worker for offline asset & app-shell caching across intermittent campus networks
try {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl) {
      window.__APLUS_SW_READY__ = Boolean(swUrl);
    },
    onOfflineReady() {
      window.__APLUS_SW_READY__ = true;
    },
    onRegisterError() {
      // Ignore SW registration warnings in dev preview
    },
  });
} catch {
  // Ignore SW errors in restricted iframe environments
}

createRoot(document.getElementById('root')!).render(<App />);
