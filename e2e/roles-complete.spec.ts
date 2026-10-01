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

/**
 * تغطية مكثّفة لميزات الواجهات الثلاث — زبون، شريك، إدارة —
 * بما يتوافق مع ما تقدّمه الشاشات فعلياً (أزرار، تبويبات، نماذج).
 */
test.describe.configure({ mode: 'serial' });

let deepCustomerEmail: string;
const DEEP_PW = 'password123';

test.beforeAll(async ({ request, baseURL }) => {
  const s = Date.now();
  deepCustomerEmail = `roles.deep.${s}@ijar-test.local`;
  const res = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      name: 'عميل تغطية كاملة',
      email: deepCustomerEmail,
      phone: `+964775${String(s).slice(-6)}`,
      password: DEEP_PW,
      role: 'customer',
    },
  });
  if (!res.ok()) throw new Error(await res.text());
});

test.describe('الزبون — كل الميزات الظاهرة في لوحة العميل', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('حجوزات + مفضلة + ملف شخصي + إعدادات (إشعارات ولغة)', async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, deepCustomerEmail, DEEP_PW);
    await openDashboard(page);

    await page.getByTestId('customer-nav-rentals').click();
    await expect(
      page.getByText('لا توجد حجوزات حالياً').or(page.locator('tbody tr').first())
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('customer-nav-favorites').click();
    await expect(page.getByText('لا توجد معدات مفضلة')).toBeVisible();

    await page.getByTestId('customer-nav-profile').click();
    await expect(page.getByTestId('customer-profile-panel')).toBeVisible();
    await expect(page.getByText('الاسم الكامل')).toBeVisible();
    await expect(page.getByText('البريد الإلكتروني')).toBeVisible();

    await page.getByTestId('customer-nav-settings').click();
    await expect(page.getByText('الإشعارات')).toBeVisible();
    await expect(page.getByText('اللغة')).toBeVisible();
    await page.getByTestId('customer-settings-notify').click();
    await page.getByTestId('customer-settings-lang').selectOption({ label: 'English' });
    await page.getByTestId('customer-settings-lang').selectOption({ label: 'العربية' });

    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });
});

test.describe('الشريك — معدات، طلبات، تقارير، إعدادات، أزرار البطاقة', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('لوحة الطلبات والمعدات مع أزرار التعديل/الحذف عند وجود معدات', async ({ page }) => {
    test.setTimeout(120_000);
    await loginUi(page, PARTNER_EMAIL, PARTNER_PASSWORD);
    await openDashboard(page);

    await expect(page.getByRole('heading', { name: 'الطلبات الأخيرة' })).toBeVisible();
    await page.getByTestId('partner-nav-equipment').click();
    await expect(page.getByRole('heading', { name: 'معداتي' })).toBeVisible();

    const editBtns = page.getByTestId('partner-equipment-edit');
    if ((await editBtns.count()) > 0) {
      await expect(editBtns.first()).toBeVisible();
      await expect(page.getByTestId('partner-equipment-delete').first()).toBeVisible();
    }

    await page.getByTestId('partner-nav-reports').click();
    await expect(page.getByText('إجمالي الإيرادات')).toBeVisible();

    await page.getByTestId('partner-nav-settings').click();
    await expect(page.getByText('حالة الاشتراك')).toBeVisible();

    await backToHomeFromDashboard(page);
    await logoutFromHeader(page);
  });
});

test.describe('الإدارة — شركاء، تصنيفات، محتوى، موافقات، كشوف، مدفوعات، إعدادات، إحصائيات', () => {
  test.beforeEach(async ({ page }) => {
    dismissDialogs(page);
  });

  test('نماذج وإلغاء + تبويبات التحكم الرئيسية', async ({ page }) => {
    test.setTimeout(180_000);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openDashboard(page);

    await page.getByTestId('admin-nav-partners').click();
    await page.getByTestId('admin-add-partner-btn').click();
    await expect(page.getByRole('heading', { name: 'إضافة شريك جديد' })).toBeVisible();
    await page.getByTestId('admin-partner-form-cancel').click();
    await expect(page.getByRole('heading', { name: 'إضافة شريك جديد' })).not.toBeVisible();

    await page.getByTestId('admin-nav-content').click();
    await page.locator('main header').getByRole('button', { name: 'تعديل' }).click();
    await expect(page.getByText('وصف المنصة')).toBeVisible();
    await page.locator('main header').getByRole('button', { name: 'إلغاء' }).click();

    await page.getByTestId('admin-nav-categories').click();
    await page.getByTestId('admin-category-toggle').click();
    await expect(page.getByRole('heading', { name: 'إضافة تصنيف جديد' })).toBeVisible();
    // إغلاق عبر نفس الزرّ يتفادى تعارض منطقة رفع الصورة مع زر الإلغاء
    await page.getByTestId('admin-category-toggle').click();
    await expect(page.getByRole('heading', { name: 'إضافة تصنيف جديد' })).not.toBeVisible();

    await page.getByTestId('admin-nav-payment-approval').click();
    await expect(page.getByText('طلبات الدفع المنتظرة')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('admin-nav-partner-statement').click();
    await expect(
      page.getByRole('heading', { name: 'كشوف حسابات الشركاء' }).first()
    ).toBeVisible();

    await page.getByTestId('admin-nav-payments').click();
    await expect(page.getByText('إجمالي الإيرادات').first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('admin-nav-settings').click();
    await expect(page.getByText('معلومات حساب المدير')).toBeVisible();

    await page.getByTestId('admin-nav-stats').click();
    await expect(page.getByText('النظام مرتبط بقاعدة البيانات')).toBeVisible();

    await page.getByTestId('admin-back-home').click();
    await logoutFromHeader(page);
  });
});
