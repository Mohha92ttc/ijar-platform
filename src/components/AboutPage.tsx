import { motion } from 'motion/react';
import { Phone, Mail, MapPin, Building, Users, Shield, Clock, ArrowRight } from 'lucide-react';

interface PlatformInfo {
  phones: string[];
  emails: string[];
  addresses: string[];
  description: string;
  mission: string;
  vision: string;
}

const defaultInfo: PlatformInfo = {
  phones: ['+964 7700 123 456', '+964 7500 789 012'],
  emails: ['info@ijar.iq', 'support@ijar.iq'],
  addresses: ['بغداد - الكرادة، شارع فلسطين', 'أربيل - عينكاوة، بالقرب من الجامعة'],
  description: 'منصة إيجار هي المنصة الرائدة في العراق لتأجير المعدات والأدوات بين الأفراد والشركات. نحن نربط بين أصحاب المعدات والشركات المحتاجة للتأجير بطريقة آمنة وموثوقة.',
  mission: 'مهمتنا هي تسهيل عملية تأجير المعدات في العراق وتوفير مصدر دخل إضافي لأصحاب المعدات مع توفير حلول اقتصادية للشركات.',
  vision: 'أن نكون المنصة الأولى والأكثر ثقة في تأجير المعدات في الشرق الأوسط.'
};

export default function AboutPage({ onBack }: { onBack: () => void }) {
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
            <h1 className="text-xl font-bold">عن المنصة</h1>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <Building size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-2">منصة إيجار</h2>
              <p className="text-blue-100">المنصة الرائدة لتأجير المعدات في العراق</p>
            </div>
          </div>
          <p className="text-lg leading-relaxed text-blue-50">
            {defaultInfo.description}
          </p>
        </motion.div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-slate-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <h3 className="text-xl font-bold">مهمتنا</h3>
            </div>
            <p className="text-slate-600 leading-relaxed">{defaultInfo.mission}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 border border-slate-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Shield className="text-amber-600" size={24} />
              </div>
              <h3 className="text-xl font-bold">رؤيتنا</h3>
            </div>
            <p className="text-slate-600 leading-relaxed">{defaultInfo.vision}</p>
          </motion.div>
        </div>

        {/* Features */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-slate-200 mb-8"
        >
          <h3 className="text-xl font-bold mb-6">لماذا تختار منصة إيجار؟</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="text-green-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold mb-1">آمن وموثوق</h4>
                <p className="text-sm text-slate-600">نظام حماية متقدم للمعاملات والبيانات</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="text-blue-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold mb-1">سريع ومباشر</h4>
                <p className="text-sm text-slate-600">تواصل مباشر بين المؤجر والمستأجر</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="text-amber-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold mb-1">مجتمع واسع</h4>
                <p className="text-sm text-slate-600">آلاف المستخدمين في جميع أنحاء العراق</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Information */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 border border-slate-200"
        >
          <h3 className="text-xl font-bold mb-6">تواصل معنا</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone className="text-blue-600" size={28} />
              </div>
              <h4 className="font-bold mb-3">أرقام الهاتف</h4>
              <div className="space-y-2">
                {defaultInfo.phones.map((phone, index) => (
                  <a 
                    key={index}
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="block text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {phone}
                  </a>
                ))}
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="text-green-600" size={28} />
              </div>
              <h4 className="font-bold mb-3">البريد الإلكتروني</h4>
              <div className="space-y-2">
                {defaultInfo.emails.map((email, index) => (
                  <a 
                    key={index}
                    href={`mailto:${email}`}
                    className="block text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {email}
                  </a>
                ))}
              </div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="text-amber-600" size={28} />
              </div>
              <h4 className="font-bold mb-3">العناوين</h4>
              <div className="space-y-2 text-slate-600">
                {defaultInfo.addresses.map((address, index) => (
                  <p key={index} className="text-sm">{address}</p>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
