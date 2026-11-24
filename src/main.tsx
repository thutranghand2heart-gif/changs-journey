import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

document.documentElement.dataset.appVersion = __APP_VERSION__;
createRoot(document.getElementById('root')!).render(<App />);

// iOS keyboard: keep bottom sheets glued to the visible area (above the keyboard) instead of leaving a dark gap.
const vv = window.visualViewport;
if (vv) {
  const sync = () => {
    const r = document.documentElement;
    r.style.setProperty('--vvh', `${vv.height}px`);
    r.style.setProperty('--vvt', `${vv.offsetTop}px`);
    r.classList.toggle('kb-open', innerHeight - vv.height > 120);
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

// Service worker: caches the app shell for offline use. Registration result is
// reported truthfully on the Offline Readiness screen, never assumed.
// Updates: the new worker activates immediately; when it takes control of an already
// running app we announce it (user data in IndexedDB is never touched by an update).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
      })
      .catch((e) => console.warn('SW registration failed', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) dispatchEvent(new CustomEvent('chang-sw-updated'));
    });
  });
}
