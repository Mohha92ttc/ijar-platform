import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { syncPushSubscriptionIfGranted } from './lib/webPush';
import { ToastHost } from './lib/toast';
import { initI18n } from './lib/i18n';

initI18n();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ToastHost />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register SW in prod always; in other envs only when push may already be granted
    const shouldRegister =
      import.meta.env.PROD ||
      (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    if (!shouldRegister) return;
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        // Quiet sync only — never prompt for permission here
        void syncPushSubscriptionIfGranted();
      })
      .catch(() => {
        // ignore SW registration failures
      });
  });
}
