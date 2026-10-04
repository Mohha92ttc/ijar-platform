import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Trash2, MapPin, Phone, ArrowRight, X, Truck } from 'lucide-react';
import type { CartLine, CartPaymentMethod } from '../lib/cartStorage';
import { paymentMethodLabel } from '../lib/cartStorage';
import { apiJson } from '../lib/api';
import TransferAccountsPanel from './TransferAccountsPanel';
import ImageUpload from './ImageUpload';
import MapPicker, { type MapPin as DeliveryPin } from './MapPicker';

export type CheckoutFormData = {
  phone: string;
  location: string;
  notes: string;
  paymentMethod: CartPaymentMethod;
  /** data URL لإثبات التحويل — إلزامي لغير الدفع عند التسليم */
  proofImage?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
};

function needsPaymentProof(m: CartPaymentMethod): boolean {
  return m !== 'cash_on_delivery';
}

export default function CheckoutPage({
  cart,
  onRemove,
  onClear,
  onComplete,
  onClose,
  submitting,
  error,
}: {
  cart: CartLine[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onComplete: (data: CheckoutFormData) => void | Promise<void>;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const defaultPay = (cart[0]?.paymentMethod || 'manual') as CartPaymentMethod;
  const [formData, setFormData] = useState({
    phone: '',
    location: '',
    notes: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<CartPaymentMethod>(defaultPay);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [deliveryPin, setDeliveryPin] = useState<DeliveryPin | null>(null);
  const needsDeliveryMap = cart.some((c) => c.wantsDelivery);
  const [ownerHints, setOwnerHints] = useState<
    Record<
      string,
      {
        delivery_fee: number;
        phone_number?: string;
        wallet_number?: string;
        card_number?: string;
        bank_account?: string;
        account_holder_name?: string;
        mastercard?: string;
        zain_cash?: string;
      }
    >
  >({});

  useEffect(() => {
    const owners = [...new Set(cart.map((c) => c.owner_id).filter(Boolean))] as string[];
    owners.forEach(async (oid) => {
      if (ownerHints[oid]) return;
      try {
        const data = await apiJson<{
          delivery_fee: number;
          phone_number?: string;
          wallet_number?: string;
          card_number?: string;
          bank_account?: string;
          account_holder_name?: string;
          mastercard?: string;
          zain_cash?: string;
        }>(`/api/payments/public-owner/${oid}`);
        setOwnerHints((prev) => ({ ...prev, [oid]: data }));
      } catch {
        // ignore
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  const rentalSum = useMemo(() => cart.reduce((s, i) => s + Number(i.rentalTotal ?? i.total), 0), [cart]);
  const deliverySum = useMemo(() => cart.reduce((s, i) => s + Number(i.deliveryFee || 0), 0), [cart]);
  const total = rentalSum + deliverySum;
  const requireProof = needsPaymentProof(paymentMethod);
  const canSubmit =
    cart.length > 0 &&
    (!requireProof || Boolean(proofDataUrl)) &&
    (!needsDeliveryMap || Boolean(deliveryPin));

  const handleProofFile = (file: File | null) => {
    if (!file) {
      setProofDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setProofDataUrl(reader.result as string);
    reader.onerror = () => setProofDataUrl(null);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireProof && !proofDataUrl) {
      alert('يرجى إرفاق صورة إثبات التحويل قبل إرسال الطلب');
      return;
    }
    if (needsDeliveryMap && !deliveryPin) {
      alert('حدد موقع التوصيل على الخريطة');
      return;
    }
    await onComplete({
      ...formData,
      paymentMethod,
      proofImage: requireProof ? proofDataUrl : null,
      deliveryLat: needsDeliveryMap && deliveryPin ? deliveryPin.lat : null,
      deliveryLng: needsDeliveryMap && deliveryPin ? deliveryPin.lng : null,
      deliveryAddress: formData.location || null,
    });
  };

  const methods: CartPaymentMethod[] = ['zain_cash', 'asia_hawala', 'manual', 'cash_on_delivery'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="checkout-page">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" data-testid="checkout-backdrop" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      >
        <div className="flex-1 p-8 overflow-y-auto border-l border-slate-100">
          <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <ShoppingBag className="text-blue-600" /> سلة الحجوزات
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 font-medium">{cart.length} معدات مختارة</span>
              {cart.length > 0 && (
                <button
                  type="button"
                  data-testid="checkout-clear-cart"
                  onClick={() => {
                    if (confirm('تفريغ السلة بالكامل؟')) onClear();
                  }}
                  className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-100"
                >
                  تفريغ السلة
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {cart.length === 0 && (
              <div className="text-center text-slate-500 py-12" data-testid="checkout-empty">
                السلة فارغة
              </div>
            )}
            {cart.map((item) => (
              <div key={`${item.id}-${item.startDate}`} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                <img src={item.image} className="w-20 h-20 rounded-xl object-cover" alt="" />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-slate-800">{item.title}</h4>
                    <button
                      type="button"
                      data-testid="checkout-remove-item"
                      onClick={() => onRemove(item.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {item.location}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-bold">
                    <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">{item.days} أيام</span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{paymentMethodLabel(item.paymentMethod)}</span>
                    {item.wantsDelivery && (
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Truck size={10} /> توصيل {Number(item.deliveryFee || 0).toLocaleString()} د.ع
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-2 text-left">{item.total.toLocaleString()} د.ع</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>مجموع الإيجار</span>
              <span>{rentalSum.toLocaleString()} د.ع</span>
            </div>
            {deliverySum > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>التوصيل</span>
                <span>{deliverySum.toLocaleString()} د.ع</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xl font-bold">
              <span>المجموع الكلي:</span>
              <span className="text-blue-600">{total.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[380px] bg-slate-50 p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">معلومات الحجز</h3>
            <button type="button" data-testid="checkout-close" onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div data-testid="checkout-error" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

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
              <label className="text-xs font-bold text-slate-500 mr-2">
                {needsDeliveryMap ? 'عنوان التوصيل (اختياري نصي)' : 'موقع العمل / الاستلام'}
              </label>
              <div className="relative">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  data-testid="checkout-location"
                  required={!needsDeliveryMap}
                  placeholder="المحافظة، المنطقة، المعلم"
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {needsDeliveryMap && (
              <div className="space-y-2" data-testid="checkout-delivery-map">
                <label className="text-xs font-bold text-slate-500">موقع التوصيل على الخريطة (إلزامي)</label>
                <MapPicker value={deliveryPin} onChange={setDeliveryPin} height={200} />
                {!deliveryPin && (
                  <p className="text-[11px] text-red-600 font-medium">حدد الدبوس قبل إرسال الطلب.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات إضافية</label>
              <textarea
                placeholder="أي تفاصيل أخرى تود إخبار الشركاء بها..."
                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2" data-testid="checkout-payment-methods">
              <label className="text-xs font-bold text-slate-500">طريقة الدفع النهائية</label>
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`checkout-pay-${m}`}
                  onClick={() => {
                    setPaymentMethod(m);
                    if (m === 'cash_on_delivery') setProofDataUrl(null);
                  }}
                  className={`w-full text-right px-3 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    paymentMethod === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {paymentMethodLabel(m)}
                </button>
              ))}
            </div>

            {(paymentMethod === 'zain_cash' || paymentMethod === 'asia_hawala' || paymentMethod === 'manual') && (
              <div className="space-y-3" data-testid="checkout-partner-accounts">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  1) انسخ حساب الشريك أدناه وحوّل المبلغ. 2) ارفع صورة إثبات التحويل. 3) الشريك يراجع الصورة ثم يوافق على الحجز.
                </p>
                {Object.entries(ownerHints).map(([oid, h]) => (
                  <TransferAccountsPanel
                    key={oid}
                    testId={`checkout-owner-${oid.slice(0, 8)}`}
                    info={{
                      title: 'حساب الشريك للتحويل',
                      subtitle: 'انسخ الرقم ثم حوّل',
                      mastercard: h.mastercard || h.card_number,
                      zain_cash: h.zain_cash || h.wallet_number,
                      phone: h.phone_number,
                      bank_account: h.bank_account,
                      account_holder: h.account_holder_name,
                    }}
                  />
                ))}
                {Object.keys(ownerHints).length === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                    الشريك لم يضف حسابات التحويل بعد — سيتم إشعاره لإضافتها من إعداداته.
                  </p>
                )}
              </div>
            )}

            {requireProof && (
              <div className="space-y-2" data-testid="checkout-payment-proof">
                <label className="text-xs font-bold text-slate-500">صورة إثبات الدفع (إلزامي)</label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  لقطة شاشة لزين كاش / حوالة / تحويل الرافدين أو أي وصل تحويل يظهر المبلغ والحساب.
                </p>
                <ImageUpload onImageSelect={handleProofFile} currentImage={proofDataUrl || undefined} className="min-h-[140px]" />
                {!proofDataUrl && (
                  <p className="text-[11px] text-red-600 font-medium">لن يُرسل الطلب بدون صورة الإثبات.</p>
                )}
              </div>
            )}

            {paymentMethod === 'cash_on_delivery' && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800">
                الدفع عند التسليم: تدفع المبلغ عند استلام المعدة. لا يلزم إرفاق إثبات تحويل.
              </div>
            )}

            <div className="pt-2">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-4">
                <p className="text-[10px] leading-relaxed font-medium text-amber-700">
                  {requireProof
                    ? 'الطلب يبقى بانتظار موافقة الشريك بعد مراجعة صورة التحويل.'
                    : 'الدفع عند التسليم: الشريك يؤكد الحجز، والدفع يتم عند الاستلام.'}
                </p>
              </div>

              <button
                type="submit"
                data-testid="checkout-submit"
                disabled={submitting || !canSubmit}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-blue-100 disabled:opacity-60"
              >
                {submitting ? 'جاري الإرسال…' : requireProof && !proofDataUrl ? 'أرفق إثبات الدفع أولاً' : 'إرسال طلبات الحجز'}
                <ArrowRight size={18} className="rotate-180 transition-transform group-hover:-translate-x-1" />
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
