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

test.describe.configure({ mode: 'serial' });

const PW = 'password123';
const ts = Date.now();
let courierEmail = '';
let courierPassword = '';

test.describe('مندوبين وتوصيل', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('الشريك ينشئ مندوب من تبويب المندوبين', async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);

    await page.getByTestId('partner-nav-couriers').click();
    await expect(page.getByTestId('partner-couriers-tab')).toBeVisible({ timeout: 15_000 });

    const phone = `0771${String(ts).slice(-7)}`;
    await page.getByTestId('partner-courier-name').fill(`مندوب E2E ${ts}`);
    await page.getByTestId('partner-courier-phone').fill(phone);
    await page.getByTestId('partner-courier-password').fill(PW);
    await page.getByTestId('partner-courier-create').click();

    await expect(page.getByTestId('partner-courier-creds')).toBeVisible({ timeout: 20_000 });
    const creds = page.getByTestId('partner-courier-creds');
    const text = await creds.innerText();
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+/);
    expect(emailMatch).toBeTruthy();
    courierEmail = emailMatch![0];
    courierPassword = PW;

    await expect(page.getByTestId('partner-courier-card').first()).toBeVisible();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('المندوب يدخل لوحة الطلبات والتقرير', async ({ page }) => {
    test.setTimeout(90_000);
    expect(courierEmail).toBeTruthy();
    await loginUi(page, courierEmail, courierPassword);
    await expect(page.getByTestId('courier-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('courier-tab-orders')).toBeVisible();
    await page.getByTestId('courier-tab-report').click();
    await expect(page.getByTestId('courier-monthly-report')).toBeVisible();
    await page.getByTestId('courier-logout').click();
    await expect(page.getByTestId('header-auth')).toBeVisible({ timeout: 15_000 });
  });

  test('الأدمن يرى تبويب المندوبين', async ({ page }) => {
    test.setTimeout(90_000);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByTestId('admin-nav-couriers')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('admin-nav-couriers').click();
    await expect(page.getByTestId('admin-couriers-tab')).toBeVisible();
  });
});
