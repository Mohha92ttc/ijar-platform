import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Phone, Lock, CreditCard, Upload, CheckCircle, XCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { apiJson } from '../lib/api';

interface PartnerRegistrationData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  subscriptionType: 'monthly' | 'quarterly' | 'yearly';
  paymentMethod: 'bank' | 'visa' | 'cash';
  paymentProof: File | null;
  agreeTerms: boolean;
}

interface PaymentInfo {
  bankAccount: string;
  accountName: string;
  bankName: string;
  swiftCode: string;
  visaNumber: string;
  cashPhone: string;
}

export default function PartnerRegistration({
  onSubmit,
  onCancel,
  onOpenTerms,
  onOpenPrivacy,
}: {
  onSubmit: (data: PartnerRegistrationData) => void;
  onCancel: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PartnerRegistrationData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    subscriptionType: 'monthly',
    paymentMethod: 'bank',
    paymentProof: null,
    agreeTerms: false
  });

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    bankAccount: '—',
    accountName: 'منصة إيجار',
    bankName: '—',
    swiftCode: '',
    visaNumber: '—',
    cashPhone: '—',
  });
  const [transferLoading, setTransferLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await apiJson<{
          bank_name?: string | null;
          bank_account_iban?: string | null;
          card_number_display?: string | null;
          zain_cash_phone?: string | null;
          account_holder_name?: string | null;
        }>('/api/platform/transfer-info');
        if (cancelled) return;
        setPaymentInfo({
          bankAccount: t.bank_account_iban || 'غير مضاف بعد',
          accountName: t.account_holder_name || 'منصة إيجار',
          bankName: t.bank_name || '—',
          swiftCode: '',
          visaNumber: t.card_number_display || 'غير مضاف بعد',
          cashPhone: t.zain_cash_phone || 'غير مضاف بعد',
        });
      } catch {
        // keep placeholders
      } finally {
        if (!cancelled) setTransferLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscriptionPrices = {
    monthly: 50000,
    quarterly: 135000,
    yearly: 480000
  };

  const currentPrice = subscriptionPrices[formData.subscriptionType];

  const updateFormData = (field: keyof PartnerRegistrationData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      alert('الرجاء ملء جميع الحقول المطلوبة');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      alert('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return false;
    }
    if (formData.password.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.agreeTerms) {
      alert('يجب الموافقة على الشروط والأحكام');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.paymentProof) {
      alert('الرجاء رفع صورة إثبات الدفع');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      onSubmit(formData);
    }
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const renderPaymentInfo = () => {
    if (transferLoading) {
      return <p className="text-sm text-slate-500">جاري تحميل حسابات التحويل من المنصة…</p>;
    }
    switch (formData.paymentMethod) {
      case 'bank':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-blue-800">معلومات التحويل البنكي:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-600">اسم البنك:</span>
                <span className="font-bold">{paymentInfo.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">اسم الحساب:</span>
                <span className="font-bold">{paymentInfo.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">رقم الحساب:</span>
                <span className="font-bold font-mono">{paymentInfo.bankAccount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">كود SWIFT:</span>
                <span className="font-bold">{paymentInfo.swiftCode}</span>
              </div>
            </div>
          </div>
        );
      case 'visa':
        return (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-green-800">معلومات الدفع بالفيزا:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-600">رقم البطاقة:</span>
                <span className="font-bold font-mono">{paymentInfo.visaNumber}</span>
              </div>
              <div className="text-green-600 text-xs mt-2">
                يمكن الدفع عبر الرابط التالي أو نسخ رقم البطاقة
              </div>
            </div>
          </div>
        );
      case 'cash':
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-amber-800">معلومات الدفع النقدي:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-amber-600">رقم الهاتف:</span>
                <span className="font-bold">{paymentInfo.cashPhone}</span>
              </div>
              <div className="text-amber-600 text-xs mt-2">
                يمكن التحويل عبر خدمات الدفع المحلية (Zain Cash، FastPay، إلخ)
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" data-testid="partner-registration-panel">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">التسجيل كشريك تجاري</h2>
          <p className="text-blue-100">انضم إلى منصة إيجار وابدأ كسب المال من معداتك</p>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mt-6">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= num ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                }`}>
                  {num}
                </div>
                {num < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step > num ? 'bg-white' : 'bg-blue-500'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-bold mb-4">المعلومات الشخصية</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل *</label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateFormData('name', e.target.value)}
                        className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl text-sm"
                        placeholder="أدخل اسمك الكامل"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني *</label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateFormData('email', e.target.value)}
                        className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl text-sm"
                        placeholder="example@email.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف *</label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl text-sm"
                        placeholder="+964 7XX XXX XXX"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور *</label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateFormData('password', e.target.value)}
                        className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl text-sm"
                        placeholder="كلمة المرور (6 أحرف على الأقل)"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">تأكيد كلمة المرور *</label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                        className="w-full pr-10 pl-4 py-3 border border-slate-200 rounded-xl text-sm"
                        placeholder="أعد إدخال كلمة المرور"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-bold mb-4">اختيار الاشتراك والدفع</h3>
                
                {/* Subscription Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">نوع الاشتراك</label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { type: 'monthly', label: 'شهري', price: subscriptionPrices.monthly },
                      { type: 'quarterly', label: 'ربع سنوي', price: subscriptionPrices.quarterly },
                      { type: 'yearly', label: 'سنوي', price: subscriptionPrices.yearly }
                    ].map((sub) => (
                      <div
                        key={sub.type}
                        onClick={() => updateFormData('subscriptionType', sub.type as any)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          formData.subscriptionType === sub.type
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-lg font-bold">{sub.label}</div>
                        <div className="text-2xl font-bold text-blue-600">{sub.price.toLocaleString()} د.ع</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">طريقة الدفع</label>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { method: 'bank', label: 'تحويل بنكي', icon: '🏦' },
                      { method: 'visa', label: 'بطاقة فيزا', icon: '💳' },
                      { method: 'cash', label: 'دفع نقدي', icon: '💵' }
                    ].map((method) => (
                      <div
                        key={method.method}
                        onClick={() => updateFormData('paymentMethod', method.method as any)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${
                          formData.paymentMethod === method.method
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-2xl mb-2">{method.icon}</div>
                        <div className="font-bold">{method.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Information */}
                {renderPaymentInfo()}

                {/* Terms */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.agreeTerms}
                      onChange={(e) => updateFormData('agreeTerms', e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-600">
                      أوافق على{' '}
                      <button
                        type="button"
                        className="text-blue-600 underline"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenTerms?.();
                        }}
                      >
                        الشروط والأحكام
                      </button>{' '}
                      و
                      <button
                        type="button"
                        className="text-blue-600 underline"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenPrivacy?.();
                        }}
                      >
                        سياسة الخصوصية
                      </button>{' '}
                      لمنصة إيجار
                    </span>
                  </label>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-bold mb-4">إثبات الدفع</h3>
                
                {/* Payment Summary */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="font-bold mb-3">ملخص الطلب:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>نوع الاشتراك:</span>
                      <span className="font-bold">
                        {formData.subscriptionType === 'monthly' ? 'شهري' :
                         formData.subscriptionType === 'quarterly' ? 'ربع سنوي' : 'سنوي'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>طريقة الدفع:</span>
                      <span className="font-bold">
                        {formData.paymentMethod === 'bank' ? 'تحويل بنكي' :
                         formData.paymentMethod === 'visa' ? 'بطاقة فيزا' : 'دفع نقدي'}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-blue-600">
                      <span>المبلغ الإجمالي:</span>
                      <span>{currentPrice.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>

                {/* Payment Proof Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    رفع صورة إثبات الدفع *
                  </label>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="text-amber-600 mt-0.5" size={16} />
                      <div className="text-sm text-amber-700">
                        <p className="font-bold mb-1">ملاحظات هامة:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• يجب أن تكون الصورة واضحة وتظهر جميع التفاصيل</li>
                          <li>• يجب أن يظهر المبلغ والتاريخ ورقم الحساب</li>
                          <li>• سيتم مراجعة الدفع خلال 24-48 ساعة</li>
                          <li>• سيتم إشعارك عبر البريد الإلكتروني عند الموافقة</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <ImageUpload
                    onImageSelect={(file) => updateFormData('paymentProof', file)}
                    className="h-64"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              data-testid="partner-registration-cancel-or-back"
              onClick={step === 1 ? onCancel : handlePrevious}
              className="flex items-center gap-2 px-6 py-3 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              {step === 1 ? 'إلغاء' : <><ArrowLeft size={16} /> السابق</>}
            </button>
            
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700"
            >
              {step === 3 ? 'إرسال الطلب' : <>التالي <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
