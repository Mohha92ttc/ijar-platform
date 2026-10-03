import React, { useEffect, useState } from 'react';
import { Smartphone, Download, Share, Plus, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
 * أزرار تثبيت تطبيق أندرويد / آيفون بجانب السلة.
 * التطبيق واحد (PWA) يخدم الزبون والشريك بعد تسجيل الدخول.
 */
export default function InstallAppButtons() {
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

  const installIos = () => setSheet('ios');

  return (
    <>
      <div className="flex items-center gap-1" data-testid="header-install-apps">
        <button
          type="button"
          data-testid="install-android"
          onClick={installAndroid}
          title="تثبيت تطبيق أندرويد"
          className="hidden xs:flex sm:flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors"
        >
          <Download size={14} />
          <span className="hidden md:inline">أندرويد</span>
        </button>
        <button
          type="button"
          data-testid="install-ios"
          onClick={installIos}
          title="تثبيت تطبيق آيفون"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
        >
          <Smartphone size={14} />
          <span className="hidden md:inline">آيفون</span>
        </button>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4" data-testid="install-sheet">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSheet(null)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {sheet === 'android' ? 'تثبيت تطبيق إيجار على أندرويد' : 'تثبيت تطبيق إيجار على آيفون'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  تطبيق واحد للزبون والشريك — بعد التثبيت سجّل دخولك وأدر حجوزاتك ومعداتك كالموقع تماماً.
                </p>
              </div>
              <button type="button" onClick={() => setSheet(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={18} />
              </button>
            </div>

            {sheet === 'android' ? (
              <ol className="space-y-3 text-sm text-slate-700 list-decimal list-inside">
                <li>افتح الموقع في Chrome على هاتفك.</li>
                <li>من القائمة ⋮ اختر «تثبيت التطبيق» أو «Add to Home screen».</li>
                <li>أو اضغط الزر أدناه إن ظهر لك زر التثبيت.</li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex gap-2 items-start">
                  <Share className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <span>في Safari اضغط زر المشاركة (المربع مع السهم للأعلى).</span>
                </li>
                <li className="flex gap-2 items-start">
                  <Plus className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <span>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</span>
                </li>
                <li className="text-xs text-slate-500">يفتح كتطبيق مستقل بدون شريط المتصفح — مناسب للزبون والشريك.</li>
              </ol>
            )}

            {sheet === 'android' && deferred && (
              <button
                type="button"
                onClick={installAndroid}
                className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm"
              >
                تثبيت الآن
              </button>
            )}

            {sheet === 'ios' && isIos() && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                أنت على آيفون الآن — استخدم زر المشاركة في Safari كما في الخطوات أعلاه.
              </p>
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
