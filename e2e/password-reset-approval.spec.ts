import { test, expect } from '@playwright/test';
import { dismissDialogs, loginUi, logoutFromHeader, openDashboard, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/ui-flow';

test.describe.configure({ mode: 'serial' });

let customerEmail = '';
const customerInitialPassword = 'password123';
const customerNewPassword = 'newPassword123';

test.beforeAll(async ({ request, baseURL }) => {
  const stamp = Date.now();
  customerEmail = `reset.customer.${stamp}@ijar-test.local`;
  const res = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      name: 'زبون إعادة تعيين',
      email: customerEmail,
      phone: `+964771${String(stamp).slice(-6)}`,
      password: customerInitialPassword,
      role: 'customer',
    },
  });
  expect(res.ok()).toBeTruthy();
});

test('زبون يطلب نسيان كلمة المرور بموافقة أدمن + رمز تأكيد', async ({ page }) => {
  dismissDialogs(page);
  test.setTimeout(180_000);

  await page.goto('/');
  await page.getByTestId('header-auth').click();
  await page.getByTestId('auth-open-forgot').click();
  await page.getByTestId('forgot-email').fill(customerEmail);
  await page.getByTestId('forgot-request').click();
  await expect(page.getByText('بانتظار موافقة الإدارة')).toBeVisible();

  await page.goto('/');
  await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByTestId('header-notifications').click();
  await expect(page.getByText('طلب نسيان كلمة مرور جديد').first()).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('notifications-close').click();

  await openDashboard(page);
  await page.getByTestId('admin-nav-customers').click();
  await expect(page.getByText(customerEmail)).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('admin-nav-password-resets').click();
  const row = page.locator('tr', { hasText: customerEmail }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });

  const approveRespPromise = page.waitForResponse(
    (r) => r.url().includes('/password-reset-requests/') && r.url().includes('/review') && r.request().method() === 'POST'
  );
  await row.getByTestId('admin-reset-approve').click();
  const approveResp = await approveRespPromise;
  const approveJson = await approveResp.json();
  const completionToken = String(approveJson.completionToken || '');
  expect(completionToken.length).toBeGreaterThan(20);
  await expect(row.getByText('approved')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('admin-back-home').click();
  await logoutFromHeader(page);

  await page.getByTestId('header-auth').click();
  await page.getByTestId('auth-open-forgot').click();
  await page.getByTestId('forgot-email').fill(customerEmail);
  await page.getByTestId('forgot-check-status').click();
  await expect(page.getByTestId('forgot-completion-token')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('forgot-completion-token').fill(completionToken);
  await page.getByTestId('forgot-new-password').fill(customerNewPassword);
  await page.getByTestId('forgot-complete').click();

  await page.getByTestId('auth-email').fill(customerEmail);
  await page.getByTestId('auth-password').fill(customerNewPassword);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('header-user-menu')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('header-notifications').click();
  await expect(page.getByText('تمت الموافقة على تغيير كلمة المرور').first()).toBeVisible({ timeout: 20_000 });
});
