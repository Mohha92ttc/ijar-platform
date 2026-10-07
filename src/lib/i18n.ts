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
