import { apiJson, getToken } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function canUseWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/** Quiet re-subscribe when permission already granted + user logged in. Never prompts. */
export async function syncPushSubscriptionIfGranted(): Promise<boolean> {
  if (!canUseWebPush() || !getToken()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = await ensureServiceWorker();
    if (!reg) return false;
    const { publicKey } = await apiJson<{ publicKey: string }>('/api/notifications/vapid-public-key');
    if (!publicKey) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }
    await apiJson('/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return true;
  } catch {
    return false;
  }
}

/** User-initiated: may request Notification permission. */
export async function enableDevicePushNotifications(): Promise<{ ok: boolean; message: string }> {
  if (!canUseWebPush()) {
    return { ok: false, message: 'المتصفح لا يدعم إشعارات الجهاز' };
  }
  if (!getToken()) {
    return { ok: false, message: 'سجّل الدخول أولاً' };
  }
  try {
    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, message: 'تم رفض إذن الإشعارات من المتصفح' };
    }
    const synced = await syncPushSubscriptionIfGranted();
    if (!synced) {
      return { ok: false, message: 'تعذر تفعيل إشعارات الجهاز' };
    }
    return { ok: true, message: 'تم تفعيل إشعارات الجهاز' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'تعذر تفعيل إشعارات الجهاز',
    };
  }
}

export async function disableDevicePushNotifications(): Promise<boolean> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
    }
    if (getToken()) {
      await apiJson('/api/notifications/subscribe', { method: 'DELETE' });
    }
    return true;
  } catch {
    return false;
  }
}
