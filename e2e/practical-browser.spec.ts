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
  ADMIN_NAV_TESTIDS,
  fillBookingSchedule,
} from './helpers/ui-flow';

/**
 * اختبارات عملية بالمتصفح — سلسلة منفصلة لكل مرحلة لتسهيل تتبع الفشل.
 * تصفية «الشريك» قبل الحجز تضمن أن الطلب يظهر لحساب الشريك المزروع.
 */
test.describe.configure({ mode: 'serial' });

let customerEmail: string;
const CUSTOMER_PW = 'password123';
let runStamp: number;

test.beforeAll(async ({ request, baseURL }) => {
  runStamp = Date.now();
  customerEmail = `live.practical.${runStamp}@ijar-test.local`;
  const res = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      name: 'عميل اختبار عملي',
      email: customerEmail,
      phone: `+964771${String(runStamp).slice(-6)}`,
      password: CUSTOMER_PW,
      role: 'customer',
    },
  });
  if (!res.ok()) {
    throw new Error(`فشل تسجيل العميل: ${res.status()} ${await res.text()}`);
  }
});

test.describe('اختبار عملي — تحكم مباشر بالمتصفح', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('1) زبون: تصفية حسب شريك مزروع ثم حجز وسلة وإتمام', async ({ page }) => {
    test.setTimeout(180_000);
    await loginUi(page, customerEmail, CUSTOMER_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'عرض الكل' }).click();
    await page.getByTestId('home-search').fill('');
    const ownerSel = page.getByTestId('home-filter-owner');
    const optCount = await ownerSel.locator('option').count();
    if (optCount > 1) {
      await ownerSel.selectOption({ index: 1 });
    }
    await page.getByTestId('home-refresh-list').click();
    await expect(page.getByTestId('equipment-book').first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('equipment-book').first().click();
    await expect(page.getByTestId('booking-modal')).toBeVisible();
    await fillBookingSchedule(page, { days: 2 });
    await page.getByTestId('booking-confirm-step1').click();
    await page.getByTestId('booking-pay-cash_on_delivery').click();
    await page.getByTestId('booking-confirm-final').click();
    await expect(page.getByTestId('header-cart')).toBeVisible();
    await page.getByTestId('header-cart').click();
    await expect(page.getByTestId('checkout-page')).toBeVisible();
    await page.getByTestId('checkout-phone').fill('07700111222');
    await page.getByTestId('checkout-location').fill('بغداد - اختبار عملي');
    await page.getByTestId('checkout-submit').click();
    await expect(page.getByTestId('checkout-page')).not.toBeVisible({ timeout: 60_000 });
    await logoutFromHeader(page);
  });

  test('2) شريك: موافقة على طلب معلّق إن وُجد', async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await expect(page.getByTestId('partner-nav-bookings')).toBeVisible();
    const approve = page.getByTestId('partner-booking-approve');
    if ((await approve.count()) > 0) {
      await approve.first().click();
    }
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('3) شريك: إضافة معدة من النموذج', async ({ page }) => {
    test.setTimeout(120_000);
    const uniqueTitle = `معدة عملي ${runStamp}`;
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-equipment').click();
    await page.getByTestId('partner-open-add-equipment').click();
    await expect(page.getByRole('heading', { name: 'إضافة معدة جديدة' })).toBeVisible();
    await page.getByPlaceholder('اسم المعدة').fill(uniqueTitle);
    await page.getByPlaceholder('التصنيف').fill('مولدات');
    await page.getByPlaceholder('السعر باليوم').fill('125000');
    await page.getByPlaceholder('وصف المعدة').fill('وصف من اختبار المتصفح العملي');
    await page.getByTestId('partner-equipment-save').click();
    await expect(page.getByText(uniqueTitle, { exact: false })).toBeVisible({ timeout: 25_000 });
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('4) زبون: جدول الحجوزات يعرض صفاً', async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, customerEmail, CUSTOMER_PW);
    await openDashboard(page);
    await page.getByTestId('customer-nav-rentals').click();
    await expect(page.getByRole('heading', { name: 'حجوزاتي' })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('5) إدارة: تمرير أقسام اللوحة', async ({ page }) => {
    test.setTimeout(120_000);
    const jsErrors: string[] = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openDashboard(page);
    for (const id of ADMIN_NAV_TESTIDS) {
      await page.getByTestId(id).click();
    }
    await expect(
      page.getByRole('heading', { level: 2, name: 'الإحصائيات والتقارير' })
    ).toBeVisible();
    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);

    expect(jsErrors, jsErrors.join(' | ')).toHaveLength(0);
  });

  test('6) سلبي: كلمة مرور خاطئة لا تُدخل', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.getByTestId('header-auth').click();
    await page.getByTestId('auth-email').fill(PARTNER_EMAIL);
    await page.getByTestId('auth-password').fill('wrong-password-xyz');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('header-user-menu')).not.toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('auth-email')).toBeVisible();
  });
});
