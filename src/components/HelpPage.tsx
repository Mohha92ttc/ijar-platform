import { motion } from 'motion/react';
import { ArrowRight, Phone, Mail, MessageCircle, HelpCircle, Search, Book, Headphones, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiJson, ApiError } from '../lib/api';

const faqData = [
  {
    question: 'كيف يمكنني تأجير معداتي على المنصة؟',
    answer: 'أنشئ حساب شريك، وبعد موافقة الإدارة أضف معداتك من لوحة الشريك مع الصور والسعر والموقع.'
  },
  {
    question: 'ما هي رسوم المنصة؟',
    answer: 'عمولة المنصة قابلة للضبط من إعدادات الإدارة وتُحتسب على عمليات الإيجار المعتمدة. لا توجد رسوم خفية على الزبون.'
  },
  {
    question: 'كيف يتم الدفع والتسليم؟',
    answer: 'الدفع عبر تحويل بنكي / زين كاش / آسيا حوالة أو عند التسليم حسب خيارات الشريك. يمكنك طلب توصيل وتحديد موقعك على الخريطة.'
  },
  {
    question: 'ماذا لو تعطلت المعدات أثناء التأجير؟',
    answer: 'تواصل مع الشريك أولاً، أو أرسل شكوى عبر نموذج المساعدة أدناه ليراجعها فريق الدعم.'
  },
  {
    question: 'كيف يمكنني إلغاء الحجز؟',
    answer: 'من لوحة «حجوزاتي» يمكنك إلغاء الحجوزات بحالة «في الانتظار» فقط، مع ذكر السبب. بعد تأكيد الشريك لا يمكن الإلغاء من اللوحة — تواصل مع الشريك أو افتح شكوى عبر الدعم.'
  },
  {
    question: 'هل التقييمات تظهر للعامة؟',
    answer: 'نعم. بعد إكمال الإيجار يمكنك تقييم التجربة، وتظهر التقييمات داخل نافذة حجز المعدة للزبائن الآخرين.'
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
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<
    { id: string; category: string; message: string; status: string; admin_notes?: string; booking_id?: string; created_at: string }[]
  >([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: 'general',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [contactPhone, setContactPhone] = useState('+964 7700 123 456');
  const [contactEmail, setContactEmail] = useState('support@ijar.iq');

  useEffect(() => {
    try {
      const b = sessionStorage.getItem('ijar_support_booking');
      if (b) {
        setBookingId(b);
        setForm((f) => ({
          ...f,
          category: 'complaint',
          message: f.message || `شكوى بخصوص الحجز رقم: ${b}\n\n`,
        }));
        sessionStorage.removeItem('ijar_support_booking');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiJson<
          { id: string; category: string; message: string; status: string; admin_notes?: string; booking_id?: string; created_at: string }[]
        >('/api/support/my-messages');
        if (!cancelled) setMyTickets(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setMyTickets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formMsg]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiJson<{ phones?: string[]; emails?: string[] }>('/api/platform/info');
        if (cancelled) return;
        if (Array.isArray(d.phones) && d.phones[0]) setContactPhone(String(d.phones[0]));
        if (Array.isArray(d.emails) && d.emails[0]) setContactEmail(String(d.emails[0]));
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        body: JSON.stringify({ ...form, booking_id: bookingId || undefined }),
      });
      setFormMsg({ type: 'ok', text: 'تم إرسال رسالتك بنجاح. سنرد خلال 24 ساعة.' });
      setForm({ name: '', email: '', category: 'general', message: '' });
      setBookingId(null);
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
            href={`tel:${contactPhone.replace(/\s/g, '')}`}
            className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow"
          >
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Phone className="text-green-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">اتصل بنا</h3>
            <p className="text-sm text-slate-600">{contactPhone}</p>
          </a>

          <a
            href={`mailto:${contactEmail}`}
            className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="text-amber-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">بريد إلكتروني</h3>
            <p className="text-sm text-slate-600">{contactEmail}</p>
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
              <h3 className="text-lg font-bold">دليل سريع</h3>
            </div>
            <ul className="space-y-3 text-slate-600">
              <li>
                <button type="button" className="text-blue-600 hover:underline text-right w-full" onClick={() => setExpandedFaq(0)}>
                  كيفية إنشاء حساب شريك
                </button>
              </li>
              <li>
                <button type="button" className="text-blue-600 hover:underline text-right w-full" onClick={() => setExpandedFaq(2)}>
                  الدفع والتسليم
                </button>
              </li>
              <li>
                <button type="button" className="text-blue-600 hover:underline text-right w-full" onClick={() => setExpandedFaq(4)}>
                  إلغاء الحجز
                </button>
              </li>
              <li>
                <button type="button" className="text-blue-600 hover:underline text-right w-full" onClick={() => setExpandedFaq(5)}>
                  التقييمات
                </button>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <Headphones className="text-green-600" size={24} />
              <h3 className="text-lg font-bold">الدعم الفني</h3>
            </div>
            <ul className="space-y-3 text-slate-600">
              <li>
                <a href="#help-contact-form" className="text-blue-600 hover:underline">مشكلة تسجيل الدخول</a>
              </li>
              <li>
                <a href="#help-contact-form" className="text-blue-600 hover:underline">مشكلة دفع / إثبات تحويل</a>
              </li>
              <li>
                <a href="#help-contact-form" className="text-blue-600 hover:underline">عطل فني في التطبيق</a>
              </li>
              <li>
                <a href="#help-contact-form" className="text-blue-600 hover:underline">اقتراح تحسين</a>
              </li>
            </ul>
          </div>
        </motion.div>

        {myTickets.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 mb-8 space-y-3" data-testid="help-my-tickets">
            <h3 className="text-lg font-bold">تذاكر الدعم الخاصة بك</h3>
            {myTickets.map((t) => (
              <div key={t.id} className="border border-slate-100 rounded-xl p-3 space-y-1">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700">{CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label || t.category}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold ${
                      t.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : t.status === 'in_progress'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.status === 'resolved' ? 'محلولة' : t.status === 'in_progress' ? 'قيد المتابعة' : 'مفتوحة'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{t.message}</p>
                {t.booking_id && <p className="text-[11px] font-mono text-violet-700">حجز: {t.booking_id}</p>}
                {t.admin_notes && (
                  <p className="text-xs text-blue-800 bg-blue-50 rounded-lg px-2 py-1.5">رد الإدارة: {t.admin_notes}</p>
                )}
                <p className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString('ar-IQ')}</p>
              </div>
            ))}
          </div>
        )}

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
            {bookingId && (
              <p className="text-xs text-violet-800 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2" data-testid="help-linked-booking">
                مرتبط بالحجز: <span className="font-mono font-bold">{bookingId}</span>
              </p>
            )}
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
