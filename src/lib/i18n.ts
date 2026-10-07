export type Lang = 'ar' | 'en';

const STORAGE_KEY = 'ijar_lang';

type Dict = Record<string, string>;

const ar: Dict = {
  'nav.cart': 'السلة',
  'nav.login': 'دخول',
  'nav.loginRegister': 'دخول / تسجيل',
  'nav.dashboard': 'لوحة التحكم',
  'nav.courierDashboard': 'لوحة المندوب',
  'nav.logout': 'تسجيل الخروج',
  'nav.searchPlaceholder': 'ابحث عن معدات أو اسم شريك…',
  'nav.close': 'إغلاق',
  'auth.loginTitle': 'تسجيل الدخول',
  'auth.registerTitle': 'إنشاء حساب جديد',
  'auth.submitLogin': 'دخول',
  'auth.submitRegister': 'إنشاء الحساب',
  'auth.processing': 'جاري المعالجة...',
  'auth.noAccount': 'ليس لديك حساب؟ سجل الآن',
  'auth.hasAccount': 'لديك حساب بالفعل؟ سجل دخولك',
  'auth.forgotPassword': 'نسيت كلمة المرور؟',
  'auth.backToLogin': 'العودة لتسجيل الدخول',
  'auth.passwordUpdated': 'تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',
  'cart.emptyTitle': 'السلة فارغة',
  'cart.emptyHint': 'أضف معدات من الصفحة الرئيسية ثم ارجع لإتمام الحجز.',
  'cart.browse': 'تصفح المعدات',
  'cart.title': 'سلة الحجوزات',
  'cart.selectedCount': 'معدات مختارة',
  'cart.clear': 'تفريغ السلة',
  'cart.clearConfirm': 'تفريغ السلة بالكامل؟',
  'empty.noResults': 'لا توجد نتائج',
  'empty.noBookings': 'لا توجد حجوزات',
  'empty.noFavorites': 'لا توجد مفضلات',
  'dash.bookings': 'الحجوزات',
  'dash.favorites': 'المفضلة',
  'dash.profile': 'الملف الشخصي',
  'dash.settings': 'الإعدادات',
  'dash.equipment': 'المعدات',
  'dash.payments': 'المدفوعات',
  'partner.nav.bookings': 'الطلبات الواصلة',
  'partner.nav.equipment': 'معداتي',
  'partner.nav.couriers': 'المندوبين',
  'partner.nav.reports': 'التقارير',
  'partner.nav.featured': 'إعلان مميز',
  'partner.nav.settings': 'الإعدادات',
  'partner.nav.home': 'العودة للرئيسية',
  'partner.nav.bookingsShort': 'طلبات',
  'partner.nav.equipmentShort': 'معدات',
  'partner.nav.couriersShort': 'مندوبين',
  'partner.nav.reportsShort': 'تقارير',
  'partner.nav.featuredShort': 'مميز',
  'partner.nav.settingsShort': 'إعدادات',
  'partner.title': 'لوحة تحكم الشريك',
  'courier.nav.orders': 'طلباتي',
  'courier.nav.report': 'تقرير الشهر',
  'courier.nav.account': 'حسابي',
  'admin.nav.partners': 'إدارة الشركاء',
  'admin.nav.customers': 'إدارة الزبائن',
  'admin.nav.couriers': 'المندوبين',
  'admin.nav.bookings': 'الحجوزات',
  'admin.nav.equipment': 'المعدات',
  'admin.nav.paymentApproval': 'موافقات الدفع',
  'admin.nav.featured': 'الإعلان المميز',
  'admin.nav.subscription': 'اشتراكات الشركاء',
  'admin.nav.passwordResets': 'طلبات تغيير كلمة المرور',
  'admin.nav.partnerStatement': 'كشوف الحسابات',
  'admin.nav.categories': 'التصنيفات',
  'admin.nav.support': 'رسائل الدعم',
  'admin.nav.insurance': 'مطالبات التأمين',
  'admin.nav.content': 'إدارة المحتوى',
  'admin.nav.payments': 'المدفوعات',
  'admin.nav.discounts': 'أكواد الخصم',
  'admin.nav.settings': 'إعدادات النظام',
  'admin.nav.stats': 'الإحصائيات',
  'admin.nav.home': 'العودة للرئيسية',
  'admin.nav.partnersShort': 'شركاء',
  'admin.nav.customersShort': 'زبائن',
  'admin.nav.couriersShort': 'مندوبين',
  'admin.nav.bookingsShort': 'حجوزات',
  'admin.nav.equipmentShort': 'معدات',
  'admin.nav.paymentShort': 'دفعات',
  'admin.nav.subscriptionShort': 'اشتراك',
  'admin.nav.categoriesShort': 'تصنيفات',
  'admin.nav.supportShort': 'دعم',
  'admin.nav.insuranceShort': 'تأمين',
  'admin.nav.discountsShort': 'خصم',
  'admin.nav.settingsShort': 'إعدادات',
  'admin.nav.statsShort': 'إحصاء',
  'admin.title': 'لوحة تحكم الإدارة',
  'admin.campaigns.title': 'حملات الخصم',
  'admin.campaigns.create': 'إنشاء حملة',
  'admin.campaigns.name': 'اسم الحملة',
  'admin.campaigns.empty': 'لا توجد حملات بعد',
  'lang.label': 'اللغة',
  'lang.hint': 'اختر لغة الواجهة',
  'lang.ar': 'العربية',
  'lang.en': 'English',
};

const en: Dict = {
  'nav.cart': 'Cart',
  'nav.login': 'Sign in',
  'nav.loginRegister': 'Sign in / Register',
  'nav.dashboard': 'Dashboard',
  'nav.courierDashboard': 'Courier dashboard',
  'nav.logout': 'Log out',
  'nav.searchPlaceholder': 'Search equipment or partner…',
  'nav.close': 'Close',
  'auth.loginTitle': 'Sign in',
  'auth.registerTitle': 'Create account',
  'auth.submitLogin': 'Sign in',
  'auth.submitRegister': 'Create account',
  'auth.processing': 'Please wait...',
  'auth.noAccount': "Don't have an account? Register",
  'auth.hasAccount': 'Already have an account? Sign in',
  'auth.forgotPassword': 'Forgot password?',
  'auth.backToLogin': 'Back to sign in',
  'auth.passwordUpdated': 'Password updated. You can sign in now.',
  'cart.emptyTitle': 'Your cart is empty',
  'cart.emptyHint': 'Add equipment from the home page, then return to checkout.',
  'cart.browse': 'Browse equipment',
  'cart.title': 'Booking cart',
  'cart.selectedCount': 'items selected',
  'cart.clear': 'Clear cart',
  'cart.clearConfirm': 'Clear the entire cart?',
  'empty.noResults': 'No results',
  'empty.noBookings': 'No bookings yet',
  'empty.noFavorites': 'No favorites yet',
  'dash.bookings': 'Bookings',
  'dash.favorites': 'Favorites',
  'dash.profile': 'Profile',
  'dash.settings': 'Settings',
  'dash.equipment': 'Equipment',
  'dash.payments': 'Payments',
  'partner.nav.bookings': 'Incoming orders',
  'partner.nav.equipment': 'My equipment',
  'partner.nav.couriers': 'Couriers',
  'partner.nav.reports': 'Reports',
  'partner.nav.featured': 'Featured ad',
  'partner.nav.settings': 'Settings',
  'partner.nav.home': 'Back to home',
  'partner.nav.bookingsShort': 'Orders',
  'partner.nav.equipmentShort': 'Gear',
  'partner.nav.couriersShort': 'Couriers',
  'partner.nav.reportsShort': 'Reports',
  'partner.nav.featuredShort': 'Featured',
  'partner.nav.settingsShort': 'Settings',
  'partner.title': 'Partner dashboard',
  'courier.nav.orders': 'My orders',
  'courier.nav.report': 'Monthly report',
  'courier.nav.account': 'My account',
  'admin.nav.partners': 'Partners',
  'admin.nav.customers': 'Customers',
  'admin.nav.couriers': 'Couriers',
  'admin.nav.bookings': 'Bookings',
  'admin.nav.equipment': 'Equipment',
  'admin.nav.paymentApproval': 'Payment approvals',
  'admin.nav.featured': 'Featured ads',
  'admin.nav.subscription': 'Partner subscriptions',
  'admin.nav.passwordResets': 'Password reset requests',
  'admin.nav.partnerStatement': 'Partner statements',
  'admin.nav.categories': 'Categories',
  'admin.nav.support': 'Support messages',
  'admin.nav.insurance': 'Insurance claims',
  'admin.nav.content': 'Platform content',
  'admin.nav.payments': 'Payments',
  'admin.nav.discounts': 'Discount codes',
  'admin.nav.settings': 'System settings',
  'admin.nav.stats': 'Statistics',
  'admin.nav.home': 'Back to home',
  'admin.nav.partnersShort': 'Partners',
  'admin.nav.customersShort': 'Customers',
  'admin.nav.couriersShort': 'Couriers',
  'admin.nav.bookingsShort': 'Bookings',
  'admin.nav.equipmentShort': 'Gear',
  'admin.nav.paymentShort': 'Payments',
  'admin.nav.subscriptionShort': 'Subs',
  'admin.nav.categoriesShort': 'Categories',
  'admin.nav.supportShort': 'Support',
  'admin.nav.insuranceShort': 'Insurance',
  'admin.nav.discountsShort': 'Discounts',
  'admin.nav.settingsShort': 'Settings',
  'admin.nav.statsShort': 'Stats',
  'admin.title': 'Admin dashboard',
  'admin.campaigns.title': 'Discount campaigns',
  'admin.campaigns.create': 'Create campaign',
  'admin.campaigns.name': 'Campaign name',
  'admin.campaigns.empty': 'No campaigns yet',
  'lang.label': 'Language',
  'lang.hint': 'Choose interface language',
  'lang.ar': 'العربية',
  'lang.en': 'English',
};

const dictionaries: Record<Lang, Dict> = { ar, en };

function normalizeLang(raw: string | null | undefined): Lang {
  return raw === 'en' ? 'en' : 'ar';
}

export function getLang(): Lang {
  try {
    return normalizeLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'ar';
  }
}

export function applyDocumentLang(lang: Lang = getLang()) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.lang = lang;
  el.dir = lang === 'en' ? 'ltr' : 'rtl';
}

/** Persist language, update document dir/lang, and notify listeners. */
export function setLang(lang: Lang) {
  const next = normalizeLang(lang);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  applyDocumentLang(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ijar-lang', { detail: next }));
  }
}

export function t(key: string, lang: Lang = getLang()): string {
  const dict = dictionaries[lang] || ar;
  return dict[key] ?? dictionaries.ar[key] ?? key;
}

/** Call once at app boot. */
export function initI18n() {
  applyDocumentLang(getLang());
}
