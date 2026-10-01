import { expect, type APIRequestContext } from '@playwright/test';

/** حسابات البذور الافتراضية (نفس سيناريو الإطلاق) */
export const SEEDED = {
  partner: { email: 'ahmed@example.com', password: 'password123' },
  admin: { email: 'admin@ijar.iq', password: 'admin123' },
} as const;

export type LoginResult = { token: string; user: { id: string; email: string; role: string } };

export async function apiLogin(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await request.post(`${baseURL}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `login failed ${email}: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as LoginResult;
  expect(body.token, 'JWT missing').toBeTruthy();
  return body;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function apiRegisterCustomer(
  request: APIRequestContext,
  baseURL: string,
  stamp: number,
  emailSlug = 'e2e.customer'
): Promise<LoginResult> {
  const email = `${emailSlug}.${stamp}@ijar-test.local`;
  const res = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      name: 'عميل مصفوفة التحكم',
      email,
      phone: `+9647700${String(stamp).slice(-6)}`,
      password: 'password123',
      role: 'customer',
    },
  });
  expect(res.ok(), `register customer: ${await res.text()}`).toBeTruthy();
  return apiLogin(request, baseURL, email, 'password123');
}
