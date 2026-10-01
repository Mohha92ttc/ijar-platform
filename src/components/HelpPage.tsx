import { motion } from 'motion/react';
import { ArrowRight, Phone, Mail, MessageCircle, HelpCircle, Search, Book, Headphones, Send } from 'lucide-react';
import { useState } from 'react';

const faqData = [
  {
    question: 'كيف يمكنني تأجير معداتي على المنصة؟',
    answer: 'قم بإنشاء حساب، ثم اضغط على "أضف معداتك"، املأ المعلومات المطلوبة، وصور المعدات، وحدد السعر والمدة المتاحة للتأجير.'
  },
  {
    question: 'ما هي رسوم المنصة؟',
    answer: 'نحصل على عمولة 10% فقط على كل عملية تأجير ناجحة. لا توجد رسوم اشتراك شهرية أو رسوم خفية أخرى.'
  },
  {
    question: 'كيف يتم الدفع والتسليم؟',
    answer: 'يتم الدفع عبر البطاقة المصرفية الآمنة. يتم تحرير المبلغ للمؤجر بعد انتهاء فترة التأجير وتسليم المعدات بنجاح.'
  },
  {
    question: 'ماذا لو تعطلت المعدات أثناء التأجير؟',
    answer: 'المؤجر مسؤول عن صيانة المعدات. في حالة العطل، يمكن التواصل مباشرة مع المؤجر أو رفع شكوى عبر المنصة.'
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

export default function HelpPage({ onBack }: { onBack: () => void }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFaq = faqData.filter(item => 
    item.question.includes(searchTerm) || item.answer.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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
        {/* Search */}
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

        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="text-blue-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">دردشة مباشرة</h3>
            <p className="text-sm text-slate-600">تواصل مع فريق الدعم فوراً</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Phone className="text-green-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">اتصل بنا</h3>
            <p className="text-sm text-slate-600">+964 7700 123 456</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail className="text-amber-600" size={28} />
            </div>
            <h3 className="font-bold mb-2">بريد إلكتروني</h3>
            <p className="text-sm text-slate-600">support@ijar.iq</p>
          </div>
        </motion.div>

        {/* FAQ */}
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

        {/* Categories */}
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

        {/* Contact Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h3 className="text-lg font-bold mb-6">أرسل لنا رسالة</h3>
          <form className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="الاسم الكامل"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>اختر نوع المشكلة</option>
              <option>استفسار عام</option>
              <option>مشكلة فنية</option>
              <option>اقتراح</option>
              <option>شكوى</option>
            </select>
            <textarea
              placeholder="اكتب رسالتك هنا..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            ></textarea>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Send size={20} />
              إرسال الرسالة
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
