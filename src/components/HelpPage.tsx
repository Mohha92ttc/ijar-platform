import { motion } from 'motion/react';
import { ArrowRight, Phone, Mail, MessageCircle, HelpCircle, Search, Book, Headphones, Send } from 'lucide-react';
import { useState } from 'react';
import { apiJson, ApiError } from '../lib/api';

const faqData = [
  {
    question: 'كيف يمكنني تأجير معداتي على المنصة؟',
    answer: 'قم بإنشاء حساب، ثم اضغط على "أضف معداتك"، املأ المعلومات المطلوبة، وصور المعدات، وحدد السعر والمدة المتاحة للتأجير.'
  },
  {
    question: 'ما هي رسوم المنصة؟',
    answer: 'نحصل على عمولة قابلة للضبط من الإدارة على كل عملية تأجير ناجحة. لا توجد رسوم خفية أخرى على الزبون.'
  },
  {
    question: 'كيف يتم الدفع والتسليم؟',
    answer: 'يمكنك الدفع عبر تحويل بنكي / زين كاش أو عند التسليم حسب إعدادات الشريك. التوصيل عبر مندوب عند طلبه مع تحديد موقعك على الخريطة.'
  },
  {
    question: 'ماذا لو تعطلت المعدات أثناء التأجير؟',
    answer: 'المؤجر مسؤول عن صيانة المعدات. في حالة العطل، يمكن التواصل مباشرة مع المؤجر أو رفع شكوى عبر نموذج المساعدة.'
  },
  {
    question: 'كيف يمكنني إلغاء الحجز؟',
    answer: 'يمكن إلغاء الحجز قبل 24 ساعة من موعد الاستلام مع استرجاع كامل المبلغ. الإلغاء بعد ذلك يخضع لسياسة الإلغاء.'
  },
  {
    question: 'هل هناك تأمين على المعدات؟',
    answer: 'نعم، نقدم تأميناً اختيارياً على المعدات بنسبة 5% من قيمة التأجير للحماية من الأضرار.'
  }
];

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'استفسار عام' },
  { value: 'technical', label: 'مشكلة فنية' },
  { value: 'suggestion', label: 'اقتراح' },
  { value: 'complaint', label: 'شكوى' },
  { value: 'billing', label: 'دفع / فوترة' },
];

export default function HelpPage({ onBack }: { onBack: () => void }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: 'general',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const filteredFaq = faqData.filter(item =>
    item.question.includes(searchTerm) || item.answer.includes(searchTerm)
  );

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setFormMsg(null);
    try {
      await apiJson('/api/support/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setFormMsg({ type: 'ok', text: 'تم إرسال رسالتك بنجاح. سنرد خلال 24 ساعة.' });
      setForm({ name: '', email: '', category: 'general', message: '' });
    } catch (err) {
      setFormMsg({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'تعذر إرسال الرسالة',
      });
    } finally {
      setSending(false);
    }
  };

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
            <h1 className="text-xl font-bold">المساعدة والدعم</h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 mb-8"
        >
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن سؤال أو موضوع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-3 pr-12 pl-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-4 mb-8"
        >
          <a
            href="#help-contact-form"
            className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow"
          >
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="text-blue-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">أرسل رسالة</h3>
            <p className="text-sm text-slate-600">نموذج الدعم أدناه</p>
          </a>

          <a
            href="tel:+9647700123456"
            className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow"
          >
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Phone className="text-green-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">اتصل بنا</h3>
            <p className="text-sm text-slate-600">+964 7700 123 456</p>
          </a>

          <a
            href="mailto:support@ijar.iq"
            className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="text-amber-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">بريد إلكتروني</h3>
            <p className="text-sm text-slate-600">support@ijar.iq</p>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="text-blue-600" size={28} />
            <h2 className="text-xl font-bold">الأسئلة الشائعة</h2>
          </div>

          <div className="space-y-4">
            {filteredFaq.map((faq, index) => (
              <div key={index} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-right flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium">{faq.question}</span>
                  <div className={`transform transition-transform ${expandedFaq === index ? 'rotate-180' : ''}`}>
                    <ArrowRight size={20} />
                  </div>
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    className="px-6 pb-4 text-slate-600"
                  >
                    {faq.answer}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-2 gap-6 mb-8"
        >
          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <Book className="text-blue-600" size={24} />
              <h3 className="text-lg font-bold">دليل المستخدم</h3>
            </div>
            <ul className="space-y-3 text-slate-600">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>كيفية إنشاء حساب</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>إضافة المعدات للتأجير</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>عملية الحجز والدفع</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span>تقييم المستخدمين</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <Headphones className="text-green-600" size={24} />
              <h3 className="text-lg font-bold">الدعم الفني</h3>
            </div>
            <ul className="space-y-3 text-slate-600">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span>مشاكل تسجيل الدخول</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span>مشاكل الدفع</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span>إبلاغ عن عطل فني</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span>اقتراحات وتحسينات</span>
              </li>
            </ul>
          </div>
        </motion.div>

        <motion.div
          id="help-contact-form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h3 className="text-lg font-bold mb-6">أرسل لنا رسالة</h3>
          <form className="space-y-4" onSubmit={submitContact} data-testid="help-contact-form">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                data-testid="help-contact-name"
                placeholder="الاسم الكامل"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                data-testid="help-contact-email"
                placeholder="البريد الإلكتروني"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              data-testid="help-contact-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <textarea
              data-testid="help-contact-message"
              placeholder="اكتب رسالتك هنا..."
              rows={4}
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            {formMsg && (
              <p
                data-testid="help-contact-status"
                className={`text-sm rounded-xl px-3 py-2 ${
                  formMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}
              >
                {formMsg.text}
              </p>
            )}
            <button
              type="submit"
              data-testid="help-contact-submit"
              disabled={sending}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Send size={20} />
              {sending ? 'جاري الإرسال…' : 'إرسال الرسالة'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
