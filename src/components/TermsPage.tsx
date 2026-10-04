import { motion } from 'motion/react';
import { ArrowRight, Shield, Users, AlertCircle, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

export default function TermsPage({ onBack }: { onBack: () => void }) {
  const [contactEmail, setContactEmail] = useState('info@ijar.iq');
  const [contactPhone, setContactPhone] = useState('+964 7700 123 456');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiJson<{ emails?: string[]; phones?: string[] }>('/api/platform/info');
        if (cancelled) return;
        if (Array.isArray(d.emails) && d.emails[0]) setContactEmail(String(d.emails[0]));
        if (Array.isArray(d.phones) && d.phones[0]) setContactPhone(String(d.phones[0]));
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="static-page-back"
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowRight className="rotate-180" size={20} />
            </button>
            <h1 className="text-xl font-bold">الشروط والأحكام</h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-8 border border-slate-200"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
              <FileText className="text-blue-600" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">شروط استخدام منصة إيجار</h2>
              <p className="text-slate-600">آخر تحديث: أكتوبر 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-slate-700 leading-relaxed">
            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Users size={18} className="text-blue-600" /> القبول بالشروط
              </h3>
              <p>
                باستخدامك لمنصة إيجار فإنك توافق على هذه الشروط. الحسابات تخضع للموافقة حسب الدور (شريك يحتاج موافقة
                الإدارة، والزبون قد يحتاج تأكيد البريد).
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Shield size={18} className="text-blue-600" /> الحجوزات والدفع
              </h3>
              <p>
                يتم إنشاء الحجز عبر المنصة، والدفع حسب خيارات الشريك (تحويل / زين كاش / عند التسليم). يمكن للزبون إلغاء
                الحجز وهو بحالة انتظار أو مؤكد. موافقة الشريك على الحجز تتضمن مراجعة إثبات الدفع عند وجوده.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600" /> المسؤولية
              </h3>
              <p>
                المؤجر مسؤول عن حالة المعدات ووصفها بدقة. المستأجر مسؤول عن استخدامها بحذر وإعادتها في الموعد. النزاعات
                تُرفع عبر صفحة المساعدة.
              </p>
            </section>

            <section className="bg-blue-50 rounded-xl p-6 mt-8">
              <h3 className="text-lg font-bold mb-3">للاستفسارات</h3>
              <p className="text-slate-600 mb-4">إذا كان لديك أي أسئلة حول هذه الشروط، تواصل معنا عبر:</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:text-blue-700 font-medium">
                  {contactEmail}
                </a>
                <a
                  href={`tel:${contactPhone.replace(/\s/g, '')}`}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {contactPhone}
                </a>
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
