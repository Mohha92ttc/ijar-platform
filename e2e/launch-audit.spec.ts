import { test, expect, type Page } from '@playwright/test';
import {
  PARTNER_EMAIL,
  PARTNER_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAV_TESTIDS,
  dismissDialogs,
  loginUi,
  openDashboard,
  logoutFromHeader,
} from './helpers/ui-flow';
import { apiRegisterCustomer } from './helpers/control';

const CUSTOMER_PASSWORD = 'password123';

function bookingDates() {
  const s = new Date();
  s.setDate(s.getDate() + 1);
  const e = new Date(s);
  e.setDate(e.getDate() + 2);
  return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
}

let customerEmail: string;

test.describe('فحص ما قبل الإطلاق — شريك / إدارة / عميل + تكرار', () => {
  test.beforeAll(async ({ request, baseURL }) => {
    const stamp = Date.now();
    customerEmail = `e2e.customer.${stamp}@ijar-test.local`;
    await apiRegisterCustomer(request, baseURL!, stamp, 'e2e.customer');
  });

  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('دورة موسّعة: كل الأدوار، الواجهة العامة، حجز وسلة وإتمام، ثم إعادة الدورات', async ({ page }) => {
    await test.step('شريك: تبويبات لوحة التحكم والعودة', async () => {
      await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
      await openDashboard(page);
      await expect(page.getByTestId('partner-nav-bookings')).toBeVisible();
      await page.getByTestId('partner-nav-equipment').click();
      await page.getByTestId('partner-nav-reports').click();
      await page.getByTestId('partner-nav-settings').click();
      await page.getByTestId('partner-nav-bookings').click();
      await page.getByTestId('partner-back-home').click();
      await page.getByTestId('header-notifications').click();
      await expect(page.getByText('الإشعارات')).toBeVisible();
      await page.getByTestId('notifications-close').click();
      await logoutFromHeader(page);
    });

    await test.step('إدارة: كل تبويبات الإدارة والعودة', async () => {
      await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await openDashboard(page);
      for (const id of ADMIN_NAV_TESTIDS) {
        await page.getByTestId(id).click();
      }
      await page.getByTestId('admin-back-home').click();
      await logoutFromHeader(page);
    });

    await test.step('عميل: لوحة التحكم ثم الصفحة الرئيسية وحجز وسلة وإتمام', async () => {
      await loginUi(page, customerEmail, CUSTOMER_PASSWORD);
      await openDashboard(page);
      await page.getByTestId('customer-nav-favorites').click();
      await page.getByTestId('customer-nav-profile').click();
      await page.getByTestId('customer-nav-settings').click();
      await page.getByTestId('customer-nav-rentals').click();
      await page.getByTestId('customer-back-home').click();

      await expect(page.getByTestId('home-search')).toBeVisible();
      await page.getByTestId('home-refresh-list').click();
      await page.getByRole('button', { name: 'مولدات', exact: true }).click();
      await page.getByRole('button', { name: 'الكل', exact: true }).click();

      await page.getByTestId('equipment-book').first().click();
      await expect(page.getByTestId('booking-modal')).toBeVisible();
      const { start, end } = bookingDates();
      await page.getByTestId('booking-date-start').fill(start);
      await page.getByTestId('booking-date-end').fill(end);
      await page.getByTestId('booking-confirm-step1').click();
      await page.getByTestId('booking-confirm-final').click();
      await expect(page.getByTestId('header-cart')).toBeVisible();
      await page.getByTestId('header-cart').click();
      await expect(page.getByTestId('checkout-page')).toBeVisible();
      await page.getByTestId('checkout-phone').fill('07700111222');
      await page.getByTestId('checkout-location').fill('بغداد - الكرادة');
      await page.getByTestId('checkout-submit').click();
      await expect(page.getByTestId('checkout-page')).not.toBeVisible({ timeout: 30_000 });

      await logoutFromHeader(page);
    });

    await test.step('واجهة عامة: بحث، تصفية، تذييل', async () => {
      await page.getByTestId('home-search').fill('مولد');
      await page.getByRole('button', { name: 'تصفية السعر' }).click();
      await page.getByRole('button', { name: 'مسح السعر' }).click();
      const ownerSel = page.getByTestId('home-filter-owner');
      if ((await ownerSel.locator('option').count()) > 1) {
        await ownerSel.selectOption({ index: 1 });
        await ownerSel.selectOption({ index: 0 });
      }
      await page.getByTestId('footer-about').click();
      await expect(page.getByRole('heading', { name: 'عن المنصة' })).toBeVisible();
      await page.getByTestId('static-page-back').click();
      await page.getByTestId('footer-terms').click();
      await expect(page.getByRole('heading', { name: 'الشروط والأحكام' })).toBeVisible();
      await page.getByTestId('static-page-back').click();
      await page.getByTestId('footer-help').click();
      await expect(page.getByRole('heading', { name: 'المساعدة والدعم' })).toBeVisible();
      await page.getByTestId('static-page-back').click();
    });

    await test.step('تكرار: شريك → عميل → إدارة', async () => {
      await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
      await openDashboard(page);
      await page.getByTestId('partner-back-home').click();
      await logoutFromHeader(page);

      await loginUi(page, customerEmail, CUSTOMER_PASSWORD);
      await openDashboard(page);
      await page.getByTestId('customer-back-home').click();
      await logoutFromHeader(page);

      await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await openDashboard(page);
      await page.getByTestId('admin-nav-partners').click();
      await page.getByTestId('admin-back-home').click();
      await logoutFromHeader(page);

      await expect(page.getByTestId('header-auth')).toBeVisible();
    });
  });
});
