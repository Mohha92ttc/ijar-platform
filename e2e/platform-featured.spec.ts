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

test.describe('منصة: تحويل بنكي + إعلان مميز', () => {
  test.describe.configure({ mode: 'serial' });
  let baseURL = '';
  let marker = '';

  test.beforeAll(async ({ request, baseURL: b }) => {
    baseURL = b!;
    marker = `featured-e2e-${Date.now()}`;
    const admin = await apiLogin(request, baseURL, SEEDED.admin.email, SEEDED.admin.password);
    await request.post(`${baseURL}/api/admin/settings`, {
      headers: { ...bearer(admin.token) },
      data: {
        name: 'إيجار',
        description: 'إعدادات اختبار',
        phones: ['+9647700123456'],
        emails: ['admin@ijar.iq'],
        addresses: ['Baghdad'],
        mission: 'Mission',
        vision: 'Vision',
        bank_name: 'بنك الاختبار',
        bank_account_iban: `IQ-${marker}`,
        card_number_display: `CARD-${marker}`,
        transfer_instructions: `تعليمات-${marker}`,
        featured_ad_price: 50000,
        featured_duration_days: 30,
        subscription_renewal_price: 100000,
      },
    });
  });

  test('واجهة برمجية: معلومات التحويل العامة', async ({ request }) => {
    const res = await request.get('/api/platform/transfer-info');
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as Record<string, unknown>;
    expect(j).toHaveProperty('featured_ad_price');
    expect(j).toHaveProperty('subscription_renewal_price');
    expect(String(j.bank_account_iban || '')).toContain('IQ-');
  });

  test('مدير: لوحة حسابات التحويل + تغيير كلمة المرور (واجهة)', async ({ page }) => {
    dismissDialogs(page);
    test.setTimeout(120_000);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('admin-nav-settings').click();
    await expect(page.getByTestId('admin-platform-bank-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('admin-bank-name')).toBeVisible();
    await page.getByTestId('admin-open-password-modal').click();
    await expect(page.getByTestId('admin-password-current')).toBeVisible();
    await page.getByTestId('admin-password-current').fill(ADMIN_PASSWORD);
    await page.getByTestId('admin-password-new').fill('AdminNewPass8!');
    await page.getByTestId('admin-password-confirm').fill('AdminNewPass8!');
    await page.getByTestId('admin-password-modal').click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('admin-password-current')).not.toBeVisible();

    await page.getByTestId('admin-bank-iban').fill(`IQ-${marker}-ui`);
    await page.getByTestId('admin-bank-card').fill(`CARD-${marker}-ui`);
    await page.getByTestId('admin-bank-instructions').fill(`تعليمات UI ${marker}`);
    await page.getByTestId('admin-platform-bank-save').click();

    await page.getByTestId('admin-nav-featured-approval').click();
    await expect(page.getByTestId('payment-approval-heading')).toContainText('الإعلان المميز');
    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);
  });

  test('شريك: تبويب إعلان مميز يعرض معلومات التحويل + إرسال طلب', async ({ page, request }) => {
    dismissDialogs(page);
    test.setTimeout(120_000);
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-featured').click();
    await expect(page.getByTestId('partner-transfer-info')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`IQ-${marker}-ui`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`CARD-${marker}-ui`)).toBeVisible({ timeout: 20_000 });

    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+G7wAAAAASUVORK5CYII=',
      'base64'
    );
    await page.getByTestId('partner-featured-proof').setInputFiles({
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    await page.getByTestId('partner-featured-submit').click();

    const admin = await apiLogin(request, baseURL, SEEDED.admin.email, SEEDED.admin.password);
    const paymentsRes = await request.get(`${baseURL}/api/admin/payments`, {
      headers: { ...bearer(admin.token) },
    });
    expect(paymentsRes.ok()).toBeTruthy();
    const payments = (await paymentsRes.json()) as Array<Record<string, unknown>>;
    const hasFeatured = payments.some(
      (p) => String(p.type) === 'featured_promotion' && ['under_review', 'pending', 'proof_uploaded'].includes(String(p.status))
    );
    expect(hasFeatured).toBeTruthy();

    await page.getByTestId('partner-nav-settings').click();
    await expect(page.getByTestId('partner-settings-transfer-info')).toBeVisible({ timeout: 15_000 });
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('أدمن: صفحة الإعلان المميز تعرض طلبات قابلة للمراجعة', async ({ page }) => {
    dismissDialogs(page);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('admin-nav-featured-approval').click();
    await expect(page.getByTestId('payment-approval-heading')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);
  });
});
