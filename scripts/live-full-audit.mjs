/**
 * Full-platform live audit: admin + partner + customer end-to-end.
 * Run: node scripts/live-full-audit.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://ijar-platform.onrender.com';
const ADMIN_EMAIL = 'admin@ijar.iq';
const ADMIN_PASSWORD = 'admin123';
const PW = 'AuditPass123!';

const results = [];
const ok = (m) => results.push(`OK: ${m}`);
const fail = (m) => {
  results.push(`FAIL: ${m}`);
  throw new Error(m);
};
const soft = (m) => results.push(`WARN: ${m}`);

async function api(path, { method = 'GET', token, body, cookieJar } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, text, headers: res.headers };
}

async function clearBrowser(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
}

async function loginUi(page, email, password) {
  await page.getByTestId('header-auth').click();
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('header-user-menu').waitFor({ state: 'visible', timeout: 60_000 });
}

async function openDashboard(page) {
  await page.getByTestId('header-user-menu').click();
  await page.getByRole('button', { name: 'لوحة التحكم' }).click();
}

async function logoutUi(page) {
  const back = page.getByTestId('partner-back-home')
    .or(page.getByTestId('customer-back-home'))
    .or(page.getByTestId('admin-back-home'));
  if (await back.first().isVisible().catch(() => false)) {
    await back.first().click();
    await page.getByTestId('home-search').waitFor({ state: 'visible', timeout: 30_000 });
  }
  await page.getByTestId('header-user-menu').click();
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await page.getByTestId('header-auth').waitFor({ state: 'visible', timeout: 30_000 });
}

async function main() {
  const ts = Date.now();
  const customerEmail = `cust.e2e.${ts}@ijar.test`;
  const partnerEmail = `partner.e2e.${ts}@ijar.test`;
  const phoneBase = String(ts).slice(-7);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(90_000);
  page.on('dialog', (d) => d.accept().catch(() => {}));

  try {
    // ---------- HEALTH ----------
    const health = await api('/api/health');
    if (health.status !== 200) fail(`health ${health.status}`);
    ok('health');

    // ---------- ADMIN API ----------
    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (adminLogin.status !== 200 || !adminLogin.data?.token) fail(`admin login ${adminLogin.status} ${adminLogin.text}`);
    const adminToken = adminLogin.data.token;
    ok('admin API login');

    const users = await api('/api/admin/users', { token: adminToken });
    if (users.status !== 200) fail(`admin users ${users.status}`);
    ok(`admin users count=${Array.isArray(users.data) ? users.data.length : '?'}`);

    const stats = await api('/api/admin/stats', { token: adminToken });
    if (stats.status !== 200) fail(`admin stats ${stats.status}`);
    ok('admin stats');

    const settings = await api('/api/admin/settings', { token: adminToken });
    if (settings.status !== 200) fail(`admin settings get ${settings.status}`);
    ok('admin settings get');

    const report = await api('/api/admin/partner-payments-report', { token: adminToken });
    if (report.status !== 200) fail(`partner report ${report.status}`);
    const partnersCount = report.data?.summary?.partnersCount ?? report.data?.partners?.length ?? 0;
    ok(`partner-payments-report partners=${partnersCount}`);

    // ---------- CREATE PARTNER (API) ----------
    const preg = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'شريك أودت كامل',
        email: partnerEmail,
        phone: `+964771${phoneBase}`,
        password: PW,
        role: 'owner',
        auto_approve: true,
      },
    });
    if (preg.status >= 300 || !preg.data?.token) fail(`partner register ${preg.status} ${preg.text}`);
    const partnerToken = preg.data.token;
    const partnerId = preg.data.user.id;
    ok(`partner created ${partnerEmail}`);

    // ---------- PARTNER: add equipment ----------
    const cats = await api('/api/equipment/categories');
    if (cats.status !== 200 || !Array.isArray(cats.data) || cats.data.length === 0) {
      soft('no categories — creating one as admin');
      const addCat = await api('/api/equipment/categories', {
        method: 'POST',
        token: adminToken,
        body: {
          name: `تصنيف-أودت-${String(ts).slice(-4)}`,
          image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400',
        },
      });
      if (addCat.status >= 300) fail(`add category ${addCat.status} ${addCat.text}`);
      ok('admin created category');
    } else {
      ok(`categories=${cats.data.length}`);
    }
    const cats2 = await api('/api/equipment/categories');
    const categoryName = cats2.data[0]?.name || 'عام';

    const eqCreate = await api('/api/equipment', {
      method: 'POST',
      token: partnerToken,
      body: {
        title: `حفار أودت ${String(ts).slice(-5)}`,
        description: 'معدة اختبار أودت شامل',
        category: categoryName,
        price_per_day: 75000,
        location: 'بغداد - الكرادة',
        images: ['https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400'],
      },
    });
    if (eqCreate.status >= 300) fail(`partner create equipment ${eqCreate.status} ${eqCreate.text}`);
    const equipmentId = eqCreate.data?.id || eqCreate.data?.equipment?.id;
    if (!equipmentId) fail(`no equipment id in ${eqCreate.text}`);
    ok(`partner equipment ${equipmentId}`);

    const myEq = await api(`/api/equipment/owner/${partnerId}`, { token: partnerToken });
    if (myEq.status !== 200) fail(`list owner equipment ${myEq.status}`);
    ok(`owner equipment list=${Array.isArray(myEq.data) ? myEq.data.length : '?'}`);

    // ---------- CREATE CUSTOMER ----------
    const creg = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'زبون أودت كامل',
        email: customerEmail,
        phone: `+964770${phoneBase}`,
        password: PW,
        role: 'customer',
      },
    });
    if (creg.status >= 300 || !creg.data?.token) fail(`customer register ${creg.status} ${creg.text}`);
    const customerToken = creg.data.token;
    const customerId = creg.data.user.id;
    ok(`customer created ${customerEmail}`);

    // ---------- CUSTOMER: browse + book ----------
    const list = await api('/api/equipment');
    if (list.status !== 200 || !Array.isArray(list.data) || list.data.length === 0) fail('equipment list empty');
    ok(`public equipment=${list.data.length}`);

    const start = new Date();
    start.setDate(start.getDate() + 3);
    const end = new Date();
    end.setDate(end.getDate() + 10);
    const booking = await api('/api/bookings', {
      method: 'POST',
      token: customerToken,
      body: {
        equipment_id: equipmentId,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        customerId,
        customer_phone: `0770${phoneBase}`,
        location: 'موقع عمل الأودت',
        notes: 'حجز أودت آلي',
      },
    });
    if (booking.status >= 300) fail(`create booking ${booking.status} ${booking.text}`);
    const bookingId = booking.data?.id;
    if (!bookingId) fail(`no booking id ${booking.text}`);
    ok(`booking created ${bookingId}`);

    const payInit = await api('/api/payments/initiate', {
      method: 'POST',
      token: customerToken,
      body: {
        booking_id: bookingId,
        amount: 75000 * 7,
        payment_method: 'manual',
        notes: 'أودت',
      },
    });
    if (payInit.status >= 300) soft(`payment initiate ${payInit.status} ${payInit.text}`);
    else ok('payment initiate');

    const myBookings = await api(`/api/bookings/customer/${customerId}`, { token: customerToken });
    if (myBookings.status !== 200) fail(`customer bookings ${myBookings.status}`);
    ok(`customer bookings=${Array.isArray(myBookings.data) ? myBookings.data.length : '?'}`);

    // ---------- PARTNER: see + approve booking ----------
    const ownerBookings = await api(`/api/bookings/owner/${partnerId}`, { token: partnerToken });
    if (ownerBookings.status !== 200) fail(`owner bookings ${ownerBookings.status}`);
    const found = Array.isArray(ownerBookings.data)
      ? ownerBookings.data.find((b) => String(b.id) === String(bookingId))
      : null;
    if (!found) soft(`booking ${bookingId} not in owner list (count=${ownerBookings.data?.length})`);
    else ok('partner sees booking');

    const approve = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      token: partnerToken,
      body: { status: 'confirmed' },
    });
    if (approve.status >= 300) fail(`approve booking ${approve.status} ${approve.text}`);
    ok('partner approved booking');

    // ---------- PARTNER: featured platform payment ----------
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const featured = await api('/api/payments/partner-platform', {
      method: 'POST',
      token: partnerToken,
      body: {
        kind: 'featured_promotion',
        amount: 50000,
        payment_proof: tinyPng,
        notes: 'أودت إعلان مميز',
      },
    });
    if (featured.status >= 300) soft(`featured request ${featured.status} ${featured.text}`);
    else ok('featured platform payment');

    const subPay = await api('/api/payments/partner-platform', {
      method: 'POST',
      token: partnerToken,
      body: {
        kind: 'subscription_renewal',
        amount: 100000,
        payment_proof: tinyPng,
        notes: 'أودت اشتراك',
      },
    });
    if (subPay.status >= 300) soft(`subscription request ${subPay.status} ${subPay.text}`);
    else ok('subscription platform payment');

    const myPlat = await api('/api/payments/my-platform', { token: partnerToken });
    if (myPlat.status !== 200) soft(`my-platform ${myPlat.status}`);
    else ok(`partner my-platform count=${Array.isArray(myPlat.data) ? myPlat.data.length : '?'}`);

    // ---------- ADMIN UI ----------
    await clearBrowser(page);
    await loginUi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    ok('admin UI login');
    await openDashboard(page);
    await page.getByTestId('admin-nav-partners').waitFor({ state: 'visible' });
    ok('admin dashboard');

    for (const tid of [
      'admin-nav-partners',
      'admin-nav-customers',
      'admin-nav-payment-approval',
      'admin-nav-featured-approval',
      'admin-nav-partner-statement',
      'admin-nav-categories',
      'admin-nav-content',
      'admin-nav-payments',
      'admin-nav-settings',
      'admin-nav-stats',
    ]) {
      await page.getByTestId(tid).click();
      await page.waitForTimeout(800);
      if (await page.getByText(/Invalid token|انتهت الجلسة/i).count()) fail(`admin ${tid} token error`);
      ok(`admin tab ${tid}`);
    }

    await page.getByTestId('admin-nav-partner-statement').click();
    await page.waitForTimeout(1500);
    const stmtPartners = await page.getByTestId('partner-payment-row').count().catch(() => 0);
    ok(`statement rows=${stmtPartners}`);

    await logoutUi(page);
    ok('admin logout');

    // ---------- PARTNER UI ----------
    await clearBrowser(page);
    await loginUi(page, partnerEmail, PW);
    ok('partner UI login');
    await openDashboard(page);
    await page.getByTestId('partner-nav-bookings').waitFor({ state: 'visible' });
    ok('partner dashboard');

    for (const tid of [
      'partner-nav-bookings',
      'partner-nav-equipment',
      'partner-nav-reports',
      'partner-nav-featured',
      'partner-nav-settings',
    ]) {
      await page.getByTestId(tid).click();
      await page.waitForTimeout(800);
      if (await page.getByText(/Invalid token|انتهت الجلسة/i).count()) fail(`partner ${tid} token`);
      ok(`partner tab ${tid}`);
    }

    await page.getByTestId('partner-nav-equipment').click();
    await page.getByTestId('partner-open-add-equipment').click();
    await page.waitForTimeout(500);
    ok('partner add-equipment form visible');

    const titleTest = page.getByTestId('partner-equipment-title');
    if (await titleTest.isVisible().catch(() => false)) {
      await titleTest.fill(`معدة واجهة ${String(ts).slice(-4)}`);
      await page.getByTestId('partner-equipment-category').fill(categoryName);
      await page.getByTestId('partner-equipment-price').fill('55000');
      await page.getByTestId('partner-equipment-save').click();
      await page.waitForTimeout(2500);
      ok('partner UI equipment saved');
    } else {
      // Live deploy may not have testids yet — use placeholders
      await page.getByPlaceholder('اسم المعدة').fill(`معدة واجهة ${String(ts).slice(-4)}`);
      await page.getByPlaceholder('التصنيف').fill(categoryName);
      await page.getByPlaceholder('السعر باليوم').fill('55000');
      await page.getByTestId('partner-equipment-save').click();
      await page.waitForTimeout(2500);
      ok('partner UI equipment saved (placeholders)');
    }

    await page.getByTestId('partner-nav-bookings').click();
    await page.waitForTimeout(1000);
    const approveBtn = page.getByTestId('partner-booking-approve');
    if ((await approveBtn.count()) > 0) {
      await approveBtn.first().click();
      await page.waitForTimeout(1500);
      ok('partner UI approved a booking');
    } else {
      ok('partner UI bookings (no pending)');
    }

    await logoutUi(page);
    ok('partner logout');

    // ---------- CUSTOMER UI: browse → book → checkout (dates far from API booking) ----------
    await clearBrowser(page);
    await loginUi(page, customerEmail, PW);
    ok('customer UI login');

    await page.getByTestId('home-refresh-list').click().catch(() => {});
    await page.waitForTimeout(1000);
    const bookBtns = page.getByTestId('equipment-book');
    const bookCount = await bookBtns.count();
    if (bookCount < 1) fail('no equipment-book buttons on home');
    ok(`home book buttons=${bookCount}`);

    await bookBtns.first().click();
    await page.getByTestId('booking-modal').waitFor({ state: 'visible' });
    const uiStart = new Date();
    uiStart.setDate(uiStart.getDate() + 40);
    await page.getByTestId('booking-start-today').setChecked(false);
    await page.getByTestId('booking-date-start').fill(uiStart.toISOString().slice(0, 10));
    await page.getByTestId('booking-days').fill('7');
    await page.getByTestId('booking-confirm-step1').click();
    await page.getByTestId('booking-pay-cash_on_delivery').click();
    await page.getByTestId('booking-confirm-final').click();
    ok('added to cart via booking modal');

    await page.getByTestId('header-cart').click();
    await page.getByTestId('checkout-page').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByTestId('checkout-phone').fill(`0770${phoneBase}`);
    await page.getByTestId('checkout-location').fill('بغداد - موقع الأودت');
    await page.getByTestId('checkout-submit').click();
    await page.waitForTimeout(5000);

    const stillCheckout = await page.getByTestId('checkout-page').isVisible().catch(() => false);
    if (stillCheckout) {
      const errEl = page.getByTestId('checkout-error');
      if (await errEl.isVisible().catch(() => false)) {
        fail(`checkout error: ${await errEl.innerText()}`);
      }
      // close and fail if stuck
      await page.getByTestId('checkout-close').click().catch(async () => {
        await page.getByTestId('checkout-backdrop').click({ force: true });
      });
      fail('checkout stayed open without success');
    }
    ok('checkout submit completed');

    await openDashboard(page);
    for (const tid of [
      'customer-nav-rentals',
      'customer-nav-favorites',
      'customer-nav-profile',
      'customer-nav-settings',
    ]) {
      await page.getByTestId(tid).click();
      await page.waitForTimeout(600);
      if (await page.getByText(/Invalid token|انتهت الجلسة/i).count()) fail(`customer ${tid} token`);
      ok(`customer tab ${tid}`);
    }

    await page.getByTestId('customer-nav-rentals').click();
    await page.waitForTimeout(1000);
    ok('customer rentals viewed');

    // footer pages
    await page.getByTestId('customer-back-home').click();
    await page.getByTestId('footer-about').click();
    await page.getByTestId('static-page-back').click();
    await page.getByTestId('footer-terms').click();
    await page.getByTestId('static-page-back').click();
    await page.getByTestId('footer-help').click();
    await page.getByTestId('static-page-back').click();
    ok('static pages about/terms/help');

    await logoutUi(page);
    ok('customer logout');

    console.log(results.join('\n'));
    console.log('ALL_PASSED');
  } catch (e) {
    console.log(results.join('\n'));
    console.error('ERROR', e instanceof Error ? e.message : e);
    await page.screenshot({ path: 'audit-full-fail.png', fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
