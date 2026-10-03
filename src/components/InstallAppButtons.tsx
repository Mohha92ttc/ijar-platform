import React, { useEffect, useMemo, useState } from 'react';
import { Smartphone, Download, Share, Plus, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function detectPlatform(): 'android' | 'ios' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  return 'other';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS Safari
    Boolean(window.navigator.standalone)
  );
}

/**
 * أزرار تثبيت أندرويد / آيفون — ظاهرة دائماً على الموبايل بجانب السلة.
 */
export default function InstallAppButtons() {
  const platform = useMemo(() => detectPlatform(), []);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [sheet, setSheet] = useState<'android' | 'ios' | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setSheet(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const installAndroid = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferred(null);
      setSheet(null);
      return;
    }
    setSheet('android');
  };

  const btnBase =
    'inline-flex items-center justify-center gap-1 min-h-9 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors active:scale-[0.98]';

  return (
    <>
      <div className="flex items-center gap-1.5" data-testid="header-install-apps">
        {/* أندرويد — ظاهر دائماً (كان مخفياً بسبب xs غير موجود في Tailwind) */}
        <button
          type="button"
          data-testid="install-android"
          onClick={installAndroid}
          title="تثبيت تطبيق أندرويد"
          className={`${btnBase} text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 ${
            platform === 'android' ? 'ring-2 ring-emerald-300' : ''
          }`}
        >
          <Download size={15} className="shrink-0" />
          <span>أندرويد</span>
        </button>
        <button
          type="button"
          data-testid="install-ios"
          onClick={() => setSheet('ios')}
          title="تثبيت تطبيق آيفون"
          className={`${btnBase} text-slate-800 bg-slate-100 hover:bg-slate-200 border-slate-200 ${
            platform === 'ios' ? 'ring-2 ring-slate-300' : ''
          }`}
        >
          <Smartphone size={15} className="shrink-0" />
          <span>آيفون</span>
        </button>
      </div>

      {/* شريط تثبيت سريع لأندرويد أسفل الشاشة */}
      {platform === 'android' && !installed && (
        <div
          className="fixed bottom-0 inset-x-0 z-[90] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
          data-testid="android-install-banner"
        >
          <button
            type="button"
            onClick={installAndroid}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-xl shadow-emerald-900/20 active:scale-[0.99]"
          >
            <div className="text-right">
              <div className="text-sm font-bold">ثبّت تطبيق إيجار</div>
              <div className="text-[11px] text-emerald-100">للزبون والشريك — يعمل مثل التطبيق</div>
            </div>
            <span className="shrink-0 bg-white text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl">تثبيت</span>
          </button>
        </div>
      )}

      {sheet && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
          data-testid="install-sheet"
        >
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSheet(null)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-200 sm:hidden mb-2" />
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {sheet === 'android' ? 'تثبيت على أندرويد' : 'تثبيت على آيفون'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  تطبيق واحد للزبون والشريك — بعد التثبيت سجّل دخولك وأدر كل عملياتك كالموقع.
                </p>
              </div>
              <button type="button" onClick={() => setSheet(null)} className="p-2 hover:bg-slate-100 rounded-full shrink-0">
                <X size={18} />
              </button>
            </div>

            {sheet === 'android' ? (
              <ol className="space-y-3 text-sm text-slate-700 list-decimal list-inside leading-relaxed">
                <li>افتح الموقع في <strong>Chrome</strong> على هاتفك.</li>
                <li>من القائمة ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>
                <li>أو اضغط «تثبيت الآن» إذا ظهر الزر أدناه.</li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex gap-2 items-start">
                  <Share className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <span>في Safari اضغط المشاركة (المربع مع السهم).</span>
                </li>
                <li className="flex gap-2 items-start">
                  <Plus className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <span>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</span>
                </li>
              </ol>
            )}

            {sheet === 'android' && (
              <button
                type="button"
                onClick={installAndroid}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm"
              >
                {deferred ? 'تثبيت الآن' : 'عرض خطوات التثبيت'}
              </button>
            )}

            <button type="button" onClick={() => setSheet(null)} className="w-full py-2.5 text-sm text-slate-500 font-medium">
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}
