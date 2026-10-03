import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://ijar-platform.onrender.com';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(90_000);
  const results = [];
  const ok = (m) => results.push('OK: ' + m);
  const fail = (m) => {
    results.push('FAIL: ' + m);
    throw new Error(m);
  };

  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
    ok('cleared session + loaded');

    const health = await page.evaluate(async () => {
      const r = await fetch('/api/health');
      return { status: r.status, text: await r.text() };
    });
    if (health.status !== 200) fail(`health ${health.status}`);
    ok('health');

    await page.getByTestId('header-auth').click();
    await page.getByTestId('auth-email').fill('admin@ijar.iq');
    await page.getByTestId('auth-password').fill('admin123');
    await page.getByTestId('auth-submit').click();
    await page.getByTestId('header-user-menu').waitFor({ state: 'visible' });
    ok('admin login');

    await page.getByTestId('header-user-menu').click();
    await page.getByRole('button', { name: 'لوحة التحكم' }).click();
    await page.getByTestId('admin-nav-partners').waitFor({ state: 'visible' });
    ok('dashboard');

    await page.getByTestId('admin-nav-partners').click();
    await page.waitForTimeout(2000);
    if (await page.getByText(/انتهت الجلسة|Invalid token/i).count()) fail('Invalid token on partners');
    const partners = await page.locator('table tbody tr').count();
    if (partners < 1) fail('no partners visible');
    ok(`partners=${partners}`);

    const partnerEmail = `audit-partner-${Date.now()}@ijar.test`;
    const createRes = await page.evaluate(async (email) => {
      const token = localStorage.getItem('ijar_token');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: 'شريك تدقيق',
          email,
          phone: '07701112233',
          password: 'Partner123!',
          role: 'owner',
          subscriptionMonths: 1,
        }),
      });
      return { status: res.status, text: await res.text() };
    }, partnerEmail);
    if (createRes.status < 200 || createRes.status >= 300) fail(`create partner ${createRes.status} ${createRes.text}`);
    ok('create partner API');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('admin-nav-partners').click();
    await page.waitForTimeout(1500);
    const partnersAfter = await page.locator('table tbody tr').count();
    if (partnersAfter < partners + 1) fail(`partner not listed after create (${partnersAfter} <= ${partners})`);
    ok(`partners after create=${partnersAfter}`);

    await page.getByTestId('admin-nav-partner-statement').click();
    await page.waitForTimeout(2500);
    if (await page.getByText(/انتهت الجلسة|Invalid token/i).count()) fail('Invalid token statements');
    const stmtCount = await page.locator('text=/شركاء|شريك|partners/i').count();
    ok(`statements ui (markers=${stmtCount})`);

    const catName = `تصنيف-آلي-${Date.now().toString().slice(-5)}`;
    const catRes = await page.evaluate(async (name) => {
      const token = localStorage.getItem('ijar_token');
      const res = await fetch('/api/equipment/categories', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name, image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400' }),
      });
      return { status: res.status, text: await res.text() };
    }, catName);
    if (catRes.status < 200 || catRes.status >= 300) fail(`category API ${catRes.status} ${catRes.text}`);
    ok(`category API ${catName}`);

    await page.getByTestId('admin-nav-content').click();
    await page.getByRole('button', { name: 'تعديل' }).click();
    const desc = page.locator('textarea').first();
    const old = await desc.inputValue();
    await desc.fill((old || 'وصف') + ' ');
    page.once('dialog', (d) => d.accept().catch(() => {}));
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click({ force: true });
    await page.waitForTimeout(2500);
    if (await page.getByText(/انتهت الجلسة|Invalid token/i).count()) fail('Invalid token content');
    if (await page.getByText('فشل حفظ').count()) fail('content save failed');
    ok('content save');

    await page.getByTestId('admin-nav-payments').click();
    await page.waitForTimeout(1500);
    if (await page.getByText(/انتهت الجلسة|Invalid token/i).count()) fail('Invalid token payments');
    ok('payments');

    await page.getByTestId('admin-nav-settings').click();
    await page.waitForTimeout(1500);
    if (await page.getByText(/انتهت الجلسة|Invalid token/i).count()) fail('Invalid token settings');
    ok('settings');

    console.log(results.join('\n'));
    console.log('ALL_PASSED');
  } catch (e) {
    console.log(results.join('\n'));
    console.error('ERROR', e instanceof Error ? e.message : e);
    await page.screenshot({ path: 'audit-live-fail.png', fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
