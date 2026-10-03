const TOKEN_KEY = 'ijar_token';
const USER_KEY = 'ijar_user';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): { id: string; name: string; email: string; role: string } | null {
  try {
    const r = localStorage.getItem(USER_KEY);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string | undefined | null, user: object) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

/** Normalize API auth errors for Arabic UI */
export function friendlyAuthMessage(raw: string): string {
  const m = String(raw || '');
  if (/invalid token/i.test(m) || /access token required/i.test(m) || /unauthorized/i.test(m)) {
    return 'انتهت الجلسة أو التوكن غير صالح. سجّل الخروج ثم الدخول من جديد.';
  }
  if (/insufficient permissions|not allowed/i.test(m)) {
    return 'ليس لديك صلاحية لهذه العملية. سجّل دخولك كزبون لإتمام الحجز.';
  }
  if (/email verification/i.test(m)) {
    return 'يلزم تأكيد البريد الإلكتروني أولاً.';
  }
  if (/pending approval/i.test(m)) {
    return 'الحساب بانتظار موافقة الإدارة.';
  }
  if (/فشل حفظ/i.test(m)) {
    return m;
  }
  return m;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...opts, headers, credentials: 'include' });
}

function isAuthCredentialPath(path: string): boolean {
  return (
    path.includes('/api/auth/login') ||
    path.includes('/api/auth/register') ||
    path.includes('/api/auth/logout') ||
    path.includes('/api/auth/forgot') ||
    path.includes('/api/auth/reset')
  );
}

export async function apiJson<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const hadToken = Boolean(getToken());
  const res = await apiFetch(path, opts);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const raw =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error?: string }).error)
        : typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message?: string }).message)
          : res.statusText;
    if (res.status === 401 && hadToken && !isAuthCredentialPath(path)) {
      clearSession();
      try {
        window.dispatchEvent(new CustomEvent('ijar:session-expired'));
      } catch {
        // ignore
      }
    } else if (res.status === 401 && hadToken && isAuthCredentialPath(path)) {
      // login/register failures should not wipe an unrelated in-progress flow oddly;
      // logout already clears — leave as-is for login wrong password without prior session
    }
    throw new ApiError(friendlyAuthMessage(raw || 'Request failed'), res.status, data);
  }
  return data as T;
}

export async function apiLogout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
  clearSession();
}

/** Validate stored session against server; clears if invalid (no session-expired alert) */
export async function validateSession(): Promise<{ id: string; name: string; email: string; role: string } | null> {
  const stored = getStoredUser();
  const token = getToken();
  if (!stored && !token) return null;
  try {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) {
      clearSession();
      return null;
    }
    const me = (await res.json()) as { id: string; name: string; email: string; role: string };
    if (token) setSession(token, me);
    else setSession(null, me);
    return me;
  } catch {
    clearSession();
    return null;
  }
}
