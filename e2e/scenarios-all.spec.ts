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
  CUSTOMER_NAV_TESTIDS,
  fillBookingSchedule,
} from './helpers/ui-flow';

/**
 * سيناريوهات واسعة: عميل، شريك، إدارة، زائر، وسلسلة رفض حجز.
 */
test.describe.configure({ mode: 'parallel' });

let sharedCustomerEmail: string;
const SHARED_PW = 'password123';
let stamp: number;

test.beforeAll(async ({ request, baseURL }) => {
  stamp = Date.now();
  sharedCustomerEmail = `scenarios.all.${stamp}@ijar-test.local`;
  const res = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      name: 'سيناريوهات شاملة',
      email: sharedCustomerEmail,
      phone: `+964772${String(stamp).slice(-6)}`,
      password: SHARED_PW,
      role: 'customer',
    },
  });
  if (!res.ok()) {
    throw new Error(`تسجيل العميل: ${res.status()} ${await res.text()}`);
  }
});

test.describe('عميل — سيناريوهات', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('إغلاق مودال الحجز بدون إتمام', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'عرض الكل' }).click();
    const ownerSel = page.getByTestId('home-filter-owner');
    if ((await ownerSel.locator('option').count()) > 1) {
      await ownerSel.selectOption({ index: 1 });
    }
    await page.getByTestId('equipment-book').first().click();
    await expect(page.getByTestId('booking-modal')).toBeVisible();
    await page.getByTestId('booking-modal-close').click();
    await expect(page.getByTestId('booking-modal')).not.toBeVisible();
    await logoutFromHeader(page);
  });

  test('زر الموعد معطّل عند غياب التواريخ', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'عرض الكل' }).click();
    const ownerSel = page.getByTestId('home-filter-owner');
    if ((await ownerSel.locator('option').count()) > 1) {
      await ownerSel.selectOption({ index: 1 });
    }
    await page.getByTestId('equipment-book').first().click();
    await expect(page.getByTestId('booking-confirm-step1')).toBeDisabled();
    await page.getByTestId('booking-modal-close').click();
    await logoutFromHeader(page);
  });

  test('تصفية فئة ثم إعادة الكل', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'مولدات', exact: true }).click();
    await page.getByRole('button', { name: 'الكل', exact: true }).click();
    await expect(page.getByTestId('home-search')).toBeVisible();
    await logoutFromHeader(page);
  });

  test('لوحة العميل — كل التبويبات', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await openDashboard(page);
    for (const id of CUSTOMER_NAV_TESTIDS) {
      await page.getByTestId(id).click();
    }
    await expect(page.getByRole('heading', { level: 2, name: 'الإعدادات' })).toBeVisible();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('الإشعارات: فتح وإغلاق', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await page.getByTestId('header-notifications').click();
    await expect(page.getByText('الإشعارات')).toBeVisible();
    await page.getByTestId('notifications-close').click();
    await logoutFromHeader(page);
  });

  test('سلة: إضافة ثم إغلاق نافذة الدفع بالخلفية', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'عرض الكل' }).click();
    const ownerSel = page.getByTestId('home-filter-owner');
    if ((await ownerSel.locator('option').count()) > 1) {
      await ownerSel.selectOption({ index: 1 });
    }
    await page.getByTestId('equipment-book').first().click();
    await fillBookingSchedule(page);
    await page.getByTestId('booking-confirm-step1').click();
    await page.getByTestId('booking-pay-manual').click();
    await page.getByTestId('booking-confirm-final').click();
    await page.getByTestId('header-cart').click();
    await expect(page.getByTestId('checkout-page')).toBeVisible();
    await page.getByTestId('checkout-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('checkout-page')).not.toBeVisible();
    await logoutFromHeader(page);
  });

  test('مودال الحجز: خطوة ثم رجوع للتواريخ', async ({ page }) => {
    await loginUi(page, sharedCustomerEmail, SHARED_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'عرض الكل' }).click();
    const ownerSel = page.getByTestId('home-filter-owner');
    if ((await ownerSel.locator('option').count()) > 1) {
      await ownerSel.selectOption({ index: 1 });
    }
    await page.getByTestId('equipment-book').first().click();
    await fillBookingSchedule(page);
    await page.getByTestId('booking-confirm-step1').click();
    await page.getByRole('button', { name: 'رجوع' }).click();
    await expect(page.getByTestId('booking-days')).toBeVisible();
    await page.getByTestId('booking-modal-close').click();
    await logoutFromHeader(page);
  });
});

test.describe('شريك — سيناريوهات', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('نموذج إضافة معدة: فتح ثم إلغاء', async ({ page }) => {
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-equipment').click();
    await page.getByTestId('partner-open-add-equipment').click();
    await expect(page.getByRole('heading', { name: 'إضافة معدة جديدة' })).toBeVisible();
    await page.getByTestId('partner-equipment-cancel-form').click();
    await expect(page.getByRole('heading', { name: 'إضافة معدة جديدة' })).not.toBeVisible();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('حفظ معدة بحقول فارغة يظهر تنبيهاً', async ({ page }) => {
    let sawDialog = false;
    page.once('dialog', (d) => {
      sawDialog = true;
      d.accept().catch(() => {});
    });
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-equipment').click();
    await page.getByTestId('partner-open-add-equipment').click();
    await page.getByTestId('partner-equipment-save').click();
    await expect.poll(() => sawDialog, { timeout: 5_000 }).toBeTruthy();
    await page.getByTestId('partner-equipment-cancel-form').click();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('تبويب التقارير يعرض بطاقات الإحصاء', async ({ page }) => {
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-reports').click();
    await expect(page.getByText('إجمالي الإيرادات')).toBeVisible();
    await expect(page.getByText('الطلبات المعلقة')).toBeVisible();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });

  test('تبويب الإعدادات يعرض الحقول', async ({ page }) => {
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('partner-nav-settings').click();
    await expect(page.getByText('معلومات الحساب')).toBeVisible();
    await expect(page.getByText('اسم الشريك')).toBeVisible();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });
});

test.describe('إدارة — سيناريوهات', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('تبويب الشركاء: بحث وحقل إدخال', async ({ page }) => {
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openDashboard(page);
    await page.getByTestId('admin-nav-partners').click();
    await expect(page.getByPlaceholder('بحث عن شريك...')).toBeVisible();
    await expect(page.getByRole('button', { name: /إضافة شريك/ })).toBeVisible();
    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);
  });

  test('جولة كاملة على التبويبات حتى الإحصائيات', async ({ page }) => {
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
  });
});

test.describe('زائر — بدون حساب', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('تذييل: عن المنصة والشروط والمساعدة', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('footer-about').click();
    await expect(page.getByRole('heading', { name: 'عن المنصة' })).toBeVisible();
    await page.getByTestId('static-page-back').click();
    await page.getByTestId('footer-terms').click();
    await expect(page.getByRole('heading', { name: 'الشروط والأحكام' })).toBeVisible();
    await page.getByTestId('static-page-back').click();
    await page.getByTestId('footer-help').click();
    await expect(page.getByRole('heading', { name: 'المساعدة والدعم' })).toBeVisible();
    await page.getByTestId('static-page-back').click();
    await expect(page.getByTestId('header-auth')).toBeVisible();
  });

  test('دخول بكلمة مرور خاطئة', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('header-auth').click();
    await page.getByTestId('auth-email').fill(ADMIN_EMAIL);
    await page.getByTestId('auth-password').fill('not-the-real-password');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('header-user-menu')).not.toBeVisible({ timeout: 8_000 });
  });
});

test.describe('سلسلة — رفض حجز', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('عميل يحجز → شريك يرفض الطلب المعلق', async ({ page, request, baseURL }) => {
    const rejStamp = Date.now();
    const rejEmail = `reject.${rejStamp}@ijar-test.local`;
    const reg = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        name: 'عميل رفض',
        email: rejEmail,
        phone: `+964773${String(rejStamp).slice(-6)}`,
        password: SHARED_PW,
        role: 'customer',
      },
    });
    if (!reg.ok()) {
      throw new Error(await reg.text());
    }

    await loginUi(page, rejEmail, SHARED_PW);
    await page.goto('/');
    await page.getByRole('button', { name: 'عرض الكل' }).click();
    const ownerSel = page.getByTestId('home-filter-owner');
    if ((await ownerSel.locator('option').count()) > 1) {
      await ownerSel.selectOption({ index: 1 });
    }
    await page.getByTestId('equipment-book').first().click();
    await fillBookingSchedule(page);
    await page.getByTestId('booking-confirm-step1').click();
    await page.getByTestId('booking-pay-manual').click();
    await page.getByTestId('booking-confirm-final').click();
    await page.getByTestId('header-cart').click();
    await expect(page.getByTestId('checkout-page')).toBeVisible();
    await page.getByTestId('checkout-phone').fill('07700111222');
    await page.getByTestId('checkout-location').fill('بغداد');
    await page.getByTestId('checkout-submit').click();
    await expect(page.getByTestId('checkout-page')).not.toBeVisible({ timeout: 60_000 });

    await logoutFromHeader(page);

    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);
    const rejectBtn = page.getByTestId('partner-booking-reject');
    await expect(rejectBtn.first()).toBeVisible({ timeout: 20_000 });
    await rejectBtn.first().click();
    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });
});
