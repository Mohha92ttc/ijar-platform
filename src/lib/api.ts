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

/** Store user profile only — auth prefers httpOnly cookie; Bearer kept as fallback for same-origin SPA. */
export function setSession(token: string | undefined | null, user: object) {
  if (token) {
    // Fallback for clients that still send Authorization; cookie is set by server
    localStorage.setItem(TOKEN_KEY, token);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
  // Prefer cookie (httpOnly); Bearer is secondary for compatibility
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(path, { ...opts, headers, credentials: 'include' });
}

export async function apiJson<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error?: string }).error)
        : typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message?: string }).message)
          : res.statusText;
    throw new ApiError(msg || 'Request failed', res.status, data);
  }
  return data as T;
}
