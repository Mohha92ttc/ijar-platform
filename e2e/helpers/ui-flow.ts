import { expect, type Page } from '@playwright/test';

export const PARTNER_EMAIL = 'ahmed@example.com';
export const PARTNER_PASSWORD = 'password123';
export const ADMIN_EMAIL = 'admin@ijar.iq';
export const ADMIN_PASSWORD = 'admin123';

export function dismissDialogs(page: Page) {
  page.on('dialog', (d) => d.accept().catch(() => {}));
}

export async function loginUi(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByTestId('header-auth').click();
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('header-user-menu')).toBeVisible({ timeout: 30_000 });
}

export async function openDashboard(page: Page) {
  await page.getByTestId('header-user-menu').click();
  await page.getByRole('button', { name: 'لوحة التحكم' }).click();
}

export async function logoutFromHeader(page: Page) {
  await page.getByTestId('header-user-menu').click();
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page.getByTestId('header-auth')).toBeVisible({ timeout: 15_000 });
}

/** لوحات الشريك/العميل/الإدارة لا تعرض الهيدر؛ يجب العودة للرئيسية قبل تسجيل الخروج من القائمة */
export async function backToHomeFromDashboard(page: Page) {
  const partner = page.getByTestId('partner-back-home');
  const customer = page.getByTestId('customer-back-home');
  const admin = page.getByTestId('admin-back-home');
  if (await partner.isVisible().catch(() => false)) {
    await partner.click();
  } else if (await customer.isVisible().catch(() => false)) {
    await customer.click();
  } else if (await admin.isVisible().catch(() => false)) {
    await admin.click();
  }
  await expect(page.getByTestId('home-search')).toBeVisible({ timeout: 15_000 });
}

/** تبويبات لوحة الإدارة (بنفس ترتيب الفحص الشامل) */
export const ADMIN_NAV_TESTIDS = [
  'admin-nav-partners',
  'admin-nav-payment-approval',
  'admin-nav-featured-approval',
  'admin-nav-partner-statement',
  'admin-nav-categories',
  'admin-nav-content',
  'admin-nav-payments',
  'admin-nav-settings',
  'admin-nav-stats',
] as const;

/** تبويبات لوحة الشريك */
export const PARTNER_NAV_TESTIDS = [
  'partner-nav-bookings',
  'partner-nav-equipment',
  'partner-nav-reports',
  'partner-nav-featured',
  'partner-nav-settings',
] as const;

/** تبويبات لوحة العميل */
export const CUSTOMER_NAV_TESTIDS = [
  'customer-nav-rentals',
  'customer-nav-favorites',
  'customer-nav-profile',
  'customer-nav-settings',
] as const;
