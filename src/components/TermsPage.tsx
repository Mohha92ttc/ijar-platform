import { motion } from 'motion/react';
import { ArrowRight, Shield, Users, AlertCircle, FileText } from 'lucide-react';

export default function TermsPage({ onBack }: { onBack: () => void }) {
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
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
              <FileText className="text-blue-600" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">شروط استخدام منصة إيجار</h2>
              <p className="text-slate-600">آخر تحديث: أبريل 2026</p>
            </div>
          </div>

          {/* Terms Sections */}
          <div className="space-y-8">
            {/* Section 1 */}
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="text-blue-600" size={24} />
                قبول الشروط
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                باستخدامك لمنصة إيجار، فإنك تقر بأنك قرأت وفهمت وقبلت هذه الشروط والأحكام. 
                إذا لم توافق على هذه الشروط، يجب عليك عدم استخدام المنصة.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="text-green-600" size={24} />
                التسجيل والمسؤولية
              </h3>
              <div className="space-y-3 text-slate-600">
                <p>• يجب أن تكون 18 سنة فأكثر لاستخدام المنصة</p>
                <p>• أنت مسؤول عن دقة المعلومات التي تقدمها</p>
                <p>• يجب عليك الحفاظ على سرية حسابك</p>
                <p>• أي استخدام غير مصرح به لحسابك هو مسؤوليتك</p>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="text-amber-600" size={24} />
                قواعد التأجير
              </h3>
              <div className="space-y-3 text-slate-600">
                <p>• يجب أن تكون المعدات المعلنة بحالة جيدة وآمنة للاستخدام</p>
                <p>• يجب وصف حالة المعدات بدقة وصدق</p>
                <p>• الأسعار المعلنة يجب أن تكون شاملة لكافة الرسوم</p>
                <p>• المؤجر مسؤول عن صيانة المعدات خلال فترة التأجير</p>
                <p>• المستأجر مسؤول عن استخدام المعدات بشكل صحيح</p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h3 className="text-xl font-bold mb-4">المدفوعات والرسوم</h3>
              <div className="space-y-3 text-slate-600">
                <p>• تحصل المنصة على عمولة 10% على كل عملية تأجير ناجحة</p>
                <p>• يتم الدفع عبر البطاقات المصرفية الآمنة</p>
                <p>• يتم تحرير المبلغ للمؤجر بعد انتهاء فترة التأجير</p>
                <p>• في حالة الإلغاء، تطبق سياسة الإلغاء المحددة</p>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h3 className="text-xl font-bold mb-4">حماية البيانات</h3>
              <div className="space-y-3 text-slate-600">
                <p>• نحن نحترم خصوصيتك ونحمي بياناتك</p>
                <p>• لا نشارك معلوماتك الشخصية مع أطراف ثالثة</p>
                <p>• نستخدم تشفيراً متقدماً لحماية المعاملات</p>
                <p>• يمكنك طلب حذف بياناتك في أي وقت</p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h3 className="text-xl font-bold mb-4">حل النزاعات</h3>
              <div className="space-y-3 text-slate-600">
                <p>• في حالة النزاع، نحاول الوساطة بين الطرفين</p>
                <p>• يمكن رفع الشكايات خلال 7 أيام من تاريخ المشكلة</p>
                <p>• القرار النهائي يكون للإدارة بناءً على الأدلة المتاحة</p>
                <p>• القانون العراقي هو المرجع في حل النزاعات</p>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <h3 className="text-xl font-bold mb-4">تعديل الشروط</h3>
              <p className="text-slate-600 leading-relaxed">
                نحتفظ بحق تعديل هذه الشروط والأحكام في أي وقت. سيتم إعلام المستخدمين 
                بأي تغييرات مهمة عبر البريد الإلكتروني أو إشعارات المنصة. 
                استمرارك في استخدام المنصة بعد التعديلات يعبر عن قبولك لها.
              </p>
            </section>

            {/* Contact */}
            <section className="bg-blue-50 rounded-xl p-6 mt-8">
              <h3 className="text-lg font-bold mb-3">للاستفسارات</h3>
              <p className="text-slate-600 mb-4">
                إذا كان لديك أي أسئلة حول هذه الشروط والأحكام، 
                يمكنك التواصل معنا عبر:
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:info@ijar.iq" className="text-blue-600 hover:text-blue-700 font-medium">
                  info@ijar.iq
                </a>
                <a href="tel:+9647700123456" className="text-blue-600 hover:text-blue-700 font-medium">
                  +964 7700 123 456
                </a>
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
