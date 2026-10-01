import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Trash2, MapPin, Phone, CreditCard, ArrowRight, X } from 'lucide-react';
import type { CartLine } from '../lib/cartStorage';

export default function CheckoutPage({
  cart,
  onRemove,
  onComplete,
  onClose,
  submitting,
  error,
}: {
  cart: CartLine[];
  onRemove: (id: string) => void;
  onComplete: (data: { phone: string; location: string; notes: string }) => void | Promise<void>;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [formData, setFormData] = useState({
    phone: '',
    location: '',
    notes: '',
  });

  const total = cart.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onComplete(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="checkout-page">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" data-testid="checkout-backdrop" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      >
        <div className="flex-1 p-8 overflow-y-auto border-l border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBag className="text-blue-600" /> سلة الحجوزات
            </h3>
            <span className="text-sm text-slate-400 font-medium">{cart.length} معدات مختارة</span>
          </div>

          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                <img src={item.image} className="w-20 h-20 rounded-xl object-cover" alt="" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-slate-800">{item.title}</h4>
                    <button type="button" onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {item.location}
                  </p>
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{item.days} أيام</div>
                    <div className="text-sm font-bold text-slate-800">{item.total.toLocaleString()} د.ع</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>المجموع الكلي:</span>
              <span className="text-blue-600">{total.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[380px] bg-slate-50 p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-8 md:hidden">
            <h3 className="text-xl font-bold">معلومات الحجز</h3>
            <button type="button" data-testid="checkout-close" onClick={onClose}>
              <X />
            </button>
          </div>
          <h3 className="text-xl font-bold mb-6 hidden md:block">معلومات الحجز</h3>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">رقم الهاتف للتواصل</label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="tel"
                  data-testid="checkout-phone"
                  required
                  placeholder="07xx xxx xxxx"
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">موقع التوصيل / العمل</label>
              <div className="relative">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  data-testid="checkout-location"
                  required
                  placeholder="المحافظة، المنطقة، المعلم"
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات إضافية</label>
              <textarea
                placeholder="أي تفاصيل أخرى تود إخبار الشركاء بها..."
                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="pt-4">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-6">
                <div className="flex gap-2 text-amber-700">
                  <CreditCard size={16} className="shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed font-medium">سيتم إرسال طلبات الحجز لكل شريك على حدة. يمكنك الدفع بعد موافقة الشركاء على طلبك.</p>
                </div>
              </div>

              <button
                type="submit"
                data-testid="checkout-submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-blue-100 disabled:opacity-60"
              >
                {submitting ? 'جاري الإرسال…' : 'إرسال طلبات الحجز'}
                <ArrowRight size={18} className="rotate-180 transition-transform group-hover:-translate-x-1" />
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
