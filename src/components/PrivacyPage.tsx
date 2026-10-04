import { motion } from 'motion/react';
import { ArrowRight, Shield, Lock, Eye, Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

export default function PrivacyPage({ onBack }: { onBack: () => void }) {
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
            <h1 className="text-xl font-bold">سياسة الخصوصية</h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-8 border border-slate-200"
          data-testid="privacy-page"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <Shield className="text-emerald-700" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">خصوصية بياناتك على إيجار</h2>
              <p className="text-slate-600">آخر تحديث: أكتوبر 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-slate-700 leading-relaxed">
            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Database size={18} className="text-emerald-700" /> ما نجمعه
              </h3>
              <p>
                نجمع بيانات الحساب (الاسم، البريد، الهاتف)، تفاصيل الحجوزات والدفع، وعناوين/إحداثيات التوصيل عند طلبها،
                ورسائل الدعم التي ترسلها عبر النموذج.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Eye size={18} className="text-emerald-700" /> كيف نستخدمها
              </h3>
              <p>
                تُستخدم البيانات لتشغيل الحجوزات، التحقق من التحويلات، إسناد التوصيل، إرسال الإشعارات، وتحسين الخدمة.
                لا نبيع بياناتك لأطراف ثالثة لأغراض تسويقية.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Lock size={18} className="text-emerald-700" /> الحماية والوصول
              </h3>
              <p>
                الوصول للبيانات محدود حسب الدور (زبون، شريك، مندوب، إدارة). يمكنك طلب تصحيح بيانات ملفك من لوحة الحساب.
                للاستفسارات: {contactEmail} · {contactPhone}
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
