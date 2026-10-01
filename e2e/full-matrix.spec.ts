import { test, expect } from '@playwright/test';
import {
  SEEDED,
  apiLogin,
  apiRegisterCustomer,
  bearer,
  type LoginResult,
} from './helpers/control';
import {
  PARTNER_EMAIL,
  PARTNER_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAV_TESTIDS,
  PARTNER_NAV_TESTIDS,
  CUSTOMER_NAV_TESTIDS,
  dismissDialogs,
  loginUi,
  openDashboard,
  logoutFromHeader,
} from './helpers/ui-flow';

/**
 * مصفوفة تحكم كاملة: مسارات API حسب الدور + توسيع واجهة التسجيل/الشريك.
 * يُنفَّذ بشكل تسلسلي لأن الجلسات تتشارك بيانات البذور.
 */
test.describe.configure({ mode: 'serial' });

let customer: LoginResult;
let partner: LoginResult;
let admin: LoginResult;
let base: string;
let equipmentId: string;

test.beforeAll(async ({ request, baseURL }) => {
  base = baseURL!;
  const stamp = Date.now();
  customer = await apiRegisterCustomer(request, base, stamp, 'matrix.customer');
  partner = await apiLogin(request, base, SEEDED.partner.email, SEEDED.partner.password);
  admin = await apiLogin(request, base, SEEDED.admin.email, SEEDED.admin.password);

  const eq = await request.get(`${base}/api/equipment`);
  expect(eq.ok()).toBeTruthy();
  const list = (await eq.json()) as Array<{ id: string }>;
  equipmentId = list[0]?.id ?? '';
});

test.describe('مصفوفة API — تغطية شاملة للمسارات', () => {
  test('عامّة بدون توكن', async ({ request }) => {
    const r1 = await request.get(`${base}/api/health`);
    expect.soft(r1.ok()).toBeTruthy();

    const r2 = await request.get(`${base}/api/database/info`);
    // Protected: must not leak schema without auth
    expect.soft([401, 403].includes(r2.status())).toBeTruthy();

    const r3 = await request.get(`${base}/api/equipment`);
    expect.soft(r3.ok()).toBeTruthy();

    const r4 = await request.get(`${base}/api/equipment/categories`);
    expect.soft(r4.ok()).toBeTruthy();

    const r5 = await request.get(`${base}/api/equipment/search?query=مولد`);
    expect.soft([200, 400, 404].includes(r5.status())).toBeTruthy();

    if (equipmentId) {
      const r6 = await request.get(`${base}/api/equipment/${equipmentId}`);
      expect.soft(r6.ok()).toBeTruthy();

      const r7 = await request.get(`${base}/api/reviews/equipment/${equipmentId}`);
      expect.soft([200, 404].includes(r7.status())).toBeTruthy();
    }

    const r8 = await request.post(`${base}/api/referral/codes/validate`, {
      data: { code: 'TEST' },
    });
    expect.soft([200, 400, 404, 422].includes(r8.status())).toBeTruthy();

    const r9 = await request.post(`${base}/api/discounts/codes/validate`, {
      data: { code: 'TEST' },
    });
    expect.soft([200, 400, 404, 422].includes(r9.status())).toBeTruthy();
  });

  test('عميل — JWT', async ({ request }) => {
    const h = { ...bearer(customer.token) };

    const me = await request.get(`${base}/api/auth/me`, { headers: h });
    expect.soft(me.ok()).toBeTruthy();

    const bc = await request.get(`${base}/api/bookings/customer/${customer.user.id}`, { headers: h });
    expect.soft(bc.ok()).toBeTruthy();

    const n = await request.get(`${base}/api/notifications/user/${customer.user.id}`, { headers: h });
    expect.soft(n.ok()).toBeTruthy();

    const ai1 = await request.post(`${base}/api/ai/recommendations`, {
      headers: h,
      data: { userId: customer.user.id, equipmentType: 'any', location: 'baghdad' },
    });
    expect.soft([200, 500].includes(ai1.status())).toBeTruthy();

    const ai2 = await request.post(`${base}/api/ai/smart-search`, {
      headers: h,
      data: { query: 'مولد', filters: {}, userId: customer.user.id },
    });
    expect.soft([200, 500].includes(ai2.status())).toBeTruthy();

    const sup = await request.get(`${base}/api/support/knowledge`, { headers: h });
    expect.soft([200, 404, 500].includes(sup.status())).toBeTruthy();

    const forbidden = await request.get(`${base}/api/admin/stats`, { headers: h });
    expect.soft([403, 401].includes(forbidden.status())).toBeTruthy();
  });

  test('شريك (مالك) — JWT', async ({ request }) => {
    const h = { ...bearer(partner.token) };
    const oid = partner.user.id;

    const me = await request.get(`${base}/api/auth/me`, { headers: h });
    expect.soft(me.ok()).toBeTruthy();

    const bo = await request.get(`${base}/api/bookings/owner/${oid}`, { headers: h });
    expect.soft(bo.ok()).toBeTruthy();

    const eo = await request.get(`${base}/api/equipment/owner/${oid}`, { headers: h });
    expect.soft(eo.ok()).toBeTruthy();

    const ps = await request.get(`${base}/api/payments/owner-settings/${oid}`, { headers: h });
    expect.soft([200, 404].includes(ps.status())).toBeTruthy();

    if (equipmentId) {
      const beq = await request.get(`${base}/api/bookings/equipment/${equipmentId}`, { headers: h });
      expect.soft(beq.ok()).toBeTruthy();
    }

    const ai = await request.post(`${base}/api/ai/demand-prediction`, {
      headers: h,
      data: { timeRange: '30d', equipmentCategory: 'مولدات', location: 'baghdad' },
    });
    expect.soft([200, 400, 500].includes(ai.status())).toBeTruthy();

    const ref = await request.get(`${base}/api/referral/programs`, { headers: h });
    expect.soft(ref.ok()).toBeTruthy();
  });

  test('إدارة — JWT', async ({ request }) => {
    const h = { ...bearer(admin.token) };

    const dbInfo = await request.get(`${base}/api/database/info`, { headers: h });
    expect.soft(dbInfo.ok()).toBeTruthy();

    const st = await request.get(`${base}/api/admin/stats`, { headers: h });
    expect.soft(st.ok()).toBeTruthy();

    const users = await request.get(`${base}/api/admin/users`, { headers: h });
    expect.soft(users.ok()).toBeTruthy();

    const book = await request.get(`${base}/api/admin/bookings`, { headers: h });
    expect.soft(book.ok()).toBeTruthy();

    const pay = await request.get(`${base}/api/admin/payments`, { headers: h });
    expect.soft(pay.ok()).toBeTruthy();

    const settings = await request.get(`${base}/api/admin/settings`, { headers: h });
    expect.soft(settings.ok()).toBeTruthy();

    const prev = await request.get(`${base}/api/payments/reviews`, { headers: h });
    expect.soft(prev.ok()).toBeTruthy();

    const churn = await request.post(`${base}/api/ai/churn-prediction`, {
      headers: h,
      data: { timeRange: '90d' },
    });
    expect.soft([200, 400, 500].includes(churn.status())).toBeTruthy();

    const aio = await request.get(`${base}/api/ai/analytics/overview`, { headers: h });
    expect.soft([200, 404, 500].includes(aio.status())).toBeTruthy();

    const disc = await request.get(`${base}/api/discounts/campaigns`, { headers: h });
    expect.soft(disc.ok()).toBeTruthy();

    const ins = await request.get(`${base}/api/insurance/policies`, { headers: h });
    expect.soft([200, 500].includes(ins.status())).toBeTruthy();

    const supa = await request.get(`${base}/api/support/analytics`, { headers: h });
    expect.soft([200, 500].includes(supa.status())).toBeTruthy();

    const trends = await request.get(`${base}/api/ai/analytics/market-trends`, { headers: h });
    expect.soft([200, 400, 500].includes(trends.status())).toBeTruthy();

    const loyalty = await request.get(`${base}/api/discounts/loyalty`, { headers: h });
    expect.soft(loyalty.ok() || [500].includes(loyalty.status())).toBeTruthy();

    const readiness = await request.get(`${base}/api/admin/readiness`, { headers: h });
    expect.soft(readiness.ok()).toBeTruthy();
    if (readiness.ok()) {
      const body = (await readiness.json()) as { ready: boolean; score: number };
      expect.soft(body.ready).toBeTruthy();
      expect.soft(body.score).toBeGreaterThanOrEqual(88);
    }
  });

  test('أمني — عميل لا يصل لحجوزات مستخدم آخر', async ({ request }) => {
    const h = { ...bearer(customer.token) };
    const r = await request.get(`${base}/api/bookings/customer/${partner.user.id}`, { headers: h });
    expect.soft(r.status()).toBe(403);
  });

  test('تكامل — دعم، عقود، إشعارات، إحالة، تطوير', async ({ request }) => {
    const ch = { ...bearer(customer.token) };
    const adm = { ...bearer(admin.token) };

    const ticket = await request.post(`${base}/api/support/tickets`, {
      headers: ch,
      data: {
        subject: 'اختبار طبقة التحكم',
        description: 'وصف',
        priority: 'low',
        category: 'general',
      },
    });
    expect.soft([200, 201].includes(ticket.status())).toBeTruthy();

    const tickets = await request.get(`${base}/api/support/tickets`, { headers: ch });
    expect.soft(tickets.ok()).toBeTruthy();

    const knowSearch = await request.get(`${base}/api/support/knowledge/search?q=test`, { headers: ch });
    expect.soft([200, 404, 500].includes(knowSearch.status())).toBeTruthy();

    const patchAll = await request.patch(`${base}/api/notifications/user/${customer.user.id}/read-all`, {
      headers: ch,
    });
    expect.soft([200, 400].includes(patchAll.status())).toBeTruthy();

    const contractC = await request.post(`${base}/api/contracts/create`, {
      headers: ch,
      data: { bookingId: 'smoke-b1', terms: {}, parties: {} },
    });
    expect.soft([200, 201].includes(contractC.status())).toBeTruthy();

    const contractG = await request.get(`${base}/api/contracts/smoke_contract_id`, { headers: ch });
    expect.soft(contractG.ok()).toBeTruthy();

    const mig = await request.get(`${base}/api/migrations/status`);
    expect.soft([200, 404].includes(mig.status())).toBeTruthy();

    const refTx = await request.get(`${base}/api/referral/transactions`, { headers: adm });
    expect.soft(refTx.ok() || [500].includes(refTx.status())).toBeTruthy();

    const match = await request.post(`${base}/api/ai/equipment-matching`, {
      headers: ch,
      data: { requirements: [], preferences: {}, location: 'baghdad' },
    });
    expect.soft([200, 400, 500].includes(match.status())).toBeTruthy();

    const pers = await request.post(`${base}/api/ai/user-personalization`, {
      headers: ch,
      data: { userId: customer.user.id },
    });
    expect.soft([200, 400, 500].includes(pers.status())).toBeTruthy();
  });
});

test.describe('مصفوفة واجهة — تسجيل ونموذج الشريك', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('تبديل التسجيل، أدوار، نموذج الشريك، ثم دخول شريك', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-hero-register').click();
    await expect(page.getByTestId('auth-email')).toBeVisible();

    await page.getByTestId('auth-toggle-mode').click();
    await expect(page.getByRole('heading', { name: 'إنشاء حساب جديد' })).toBeVisible();

    await page.getByTestId('auth-role-owner').click();
    await page.getByTestId('auth-open-partner-extra').click();
    await expect(page.getByTestId('partner-registration-panel')).toBeVisible();
    await page.getByTestId('partner-registration-cancel-or-back').click();
    await expect(page.getByTestId('partner-registration-panel')).not.toBeVisible();

    await page.getByTestId('auth-toggle-mode').click();
    await page.getByTestId('auth-email').fill(PARTNER_EMAIL);
    await page.getByTestId('auth-password').fill(PARTNER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('header-user-menu')).toBeVisible({ timeout: 30_000 });
    await logoutFromHeader(page);
  });

  test('مسار سريع: دخول عميل من البذور المصفوفة', async ({ page }) => {
    await loginUi(page, customer.user.email, 'password123');
    await expect(page.getByTestId('header-user-menu')).toBeVisible();
    await logoutFromHeader(page);
  });

  test('جولة تحكم — تبويبات إدارة وشريك وعميل + تصفية السعر', async ({ page }) => {
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openDashboard(page);
    for (const id of ADMIN_NAV_TESTIDS) {
      await page.getByTestId(id).click();
    }
    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);

    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    for (const id of PARTNER_NAV_TESTIDS) {
      await page.getByTestId(id).click();
    }
    await page.getByTestId('partner-back-home').click();
    await logoutFromHeader(page);

    await loginUi(page, customer.user.email, 'password123');
    await openDashboard(page);
    for (const id of CUSTOMER_NAV_TESTIDS) {
      await page.getByTestId(id).click();
    }
    await page.getByTestId('customer-back-home').click();
    await logoutFromHeader(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'تصفية السعر' }).click();
    await expect(page.getByText('أقل سعر', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'مسح السعر' }).click();
  });
});
