import { test, expect } from '@playwright/test';
import {
  dismissDialogs,
  loginUi,
  openDashboard,
  logoutFromHeader,
  backToHomeFromDashboard,
  PARTNER_EMAIL,
  PARTNER_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from './helpers/ui-flow';
import { apiLogin, bearer, SEEDED } from './helpers/control';

test.describe.configure({ mode: 'serial' });

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+G7wAAAAASUVORK5CYII=',
  'base64'
);

test.describe('مدفوعات الشركاء + الإشعارات', () => {
  let baseURL = '';
  let pendingPartnerEmail = '';
  const pendingPartnerPassword = 'password123';

  test.beforeAll(async ({ request, baseURL: b }) => {
    baseURL = b!;
    const stamp = Date.now();
    pendingPartnerEmail = `pending.partner.${stamp}@ijar-test.local`;
    const reg = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'شريك بانتظار الموافقة',
        email: pendingPartnerEmail,
        phone: `+964772${String(stamp).slice(-6)}`,
        password: pendingPartnerPassword,
        role: 'owner',
      },
    });
    expect(reg.ok() || reg.status() === 201).toBeTruthy();
    const regBody = await reg.json();
    expect(regBody.pending).toBeTruthy();
    expect(regBody.token).toBeFalsy();

    // Pending partner must not get a session via login either
    const loginTry = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: pendingPartnerEmail, password: pendingPartnerPassword },
    });
    expect(loginTry.ok()).toBeFalsy();
  });

  test('إشعار أدمن عند طلب انضمام شريك معلّق', async ({ page }) => {
    dismissDialogs(page);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.getByTestId('header-notifications').click();
    await expect(page.getByText('طلب انضمام شريك جديد').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(pendingPartnerEmail).first()).toBeVisible();
    await page.getByTestId('notifications-close').click();
    await logoutFromHeader(page);
  });

  test('شريك يرسل دفع إعلان مميز + يظهر في تقريره ويُشعر الأدمن', async ({ page, request }) => {
    dismissDialogs(page);
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept().catch(() => {}));

    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-featured').click();
    await expect(page.getByTestId('partner-transfer-info')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('partner-featured-proof').setInputFiles({
      name: 'proof-pay.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    await page.getByTestId('partner-featured-submit').click();

    await page.getByTestId('partner-nav-reports').click();
    await expect(page.getByTestId('partner-payments-report-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-my-payment-row').first()).toBeVisible({ timeout: 20_000 });

    await backToHomeFromDashboard(page);
    await page.getByTestId('header-notifications').click();
    await expect(page.getByText('تم استلام طلب الدفع').first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('notifications-close').click();
    await logoutFromHeader(page);

    // Admin notification + report
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.getByTestId('header-notifications').click();
    await expect(page.getByText(/طلب دفع شريك معلّق|إعلان مميز/).first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('notifications-close').click();

    await openDashboard(page);
    await page.getByTestId('admin-nav-partner-statement').click();
    await expect(page.getByTestId('partner-payments-report')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('كشوف مدفوعات الشركاء')).toBeVisible();

    const admin = await apiLogin(request, baseURL, SEEDED.admin.email, SEEDED.admin.password);
    const report = await request.get(`${baseURL}/api/admin/partner-payments-report`, {
      headers: { ...bearer(admin.token) },
    });
    expect(report.ok()).toBeTruthy();
    const body = (await report.json()) as { summary: { pendingRequests: number }; transactions: any[] };
    expect(body.summary.pendingRequests).toBeGreaterThanOrEqual(1);
    expect(body.transactions.some((t) => t.type === 'featured_promotion')).toBeTruthy();

    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);
  });

  test('أدمن يوافق على دفع شريك فيصل إشعار للشريك', async ({ page, request }) => {
    dismissDialogs(page);
    test.setTimeout(180_000);

    const admin = await apiLogin(request, baseURL, SEEDED.admin.email, SEEDED.admin.password);
    const paymentsRes = await request.get(`${baseURL}/api/admin/payments`, {
      headers: { ...bearer(admin.token) },
    });
    expect(paymentsRes.ok()).toBeTruthy();
    const payments = (await paymentsRes.json()) as Array<Record<string, unknown>>;
    const pending = payments.find(
      (p) =>
        String(p.type) === 'featured_promotion' &&
        ['under_review', 'pending', 'proof_uploaded'].includes(String(p.status))
    );
    expect(pending).toBeTruthy();
    const review = await request.post(`${baseURL}/api/admin/payments/${pending!.id}/review`, {
      headers: { ...bearer(admin.token) },
      data: { approve: true },
    });
    if (!review.ok()) {
      throw new Error(`review failed ${review.status()}: ${await review.text()} | pending=${JSON.stringify(pending)}`);
    }

    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await page.getByTestId('header-notifications').click();
    await expect(page.getByText(/تم تفعيل الإعلان المميز|تم استلام طلب الدفع/).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('notifications-close').click();
    await logoutFromHeader(page);
  });
});
