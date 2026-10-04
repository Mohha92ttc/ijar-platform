import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, ShieldCheck, CreditCard, Info, X, Truck, Banknote, Star } from 'lucide-react';
import type { CartPaymentMethod } from '../lib/cartStorage';
import { paymentMethodLabel } from '../lib/cartStorage';
import { apiJson } from '../lib/api';

type ConfirmPayload = {
  dates: { start: string; end: string };
  total: number;
  rentalTotal: number;
  deliveryFee: number;
  paymentMethod: CartPaymentMethod;
  wantsDelivery: boolean;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** يضيف أيام تقويمية لتاريخ YYYY-MM-DD */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatArDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('ar-IQ', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function BookingModal({
  equipment,
  onClose,
  onConfirm,
  deliveryFee = 0,
}: {
  equipment: any;
  onClose: () => void;
  onConfirm: (data: ConfirmPayload) => void;
  deliveryFee?: number;
}) {
  const [startToday, setStartToday] = useState(true);
  const [startDate, setStartDate] = useState(todayIso);
  const [dayCount, setDayCount] = useState(1);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<CartPaymentMethod | null>(null);
  const [wantsDelivery, setWantsDelivery] = useState(false);
  const [reviews, setReviews] = useState<
    { id: string; rating: number; comment?: string; reviewer_name?: string; created_at: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!equipment?.id) return;
      try {
        const rows = await apiJson<any[]>(`/api/reviews/equipment/${equipment.id}`);
        if (!cancelled && Array.isArray(rows)) {
          setReviews(
            rows.slice(0, 5).map((r) => ({
              id: String(r.id),
              rating: Number(r.rating) || 0,
              comment: r.comment ? String(r.comment) : undefined,
              reviewer_name: r.reviewer_name ? String(r.reviewer_name) : undefined,
              created_at: String(r.created_at || ''),
            }))
          );
        }
      } catch {
        if (!cancelled) setReviews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equipment?.id]);

  const effectiveStart = startToday ? todayIso() : startDate;
  const endDate = useMemo(() => {
    if (!effectiveStart || dayCount < 1) return '';
    return addDaysIso(effectiveStart, dayCount);
  }, [effectiveStart, dayCount]);

  const days = dayCount >= 1 && effectiveStart && endDate ? dayCount : 0;
  const rentalTotal = days * equipment.price;
  const fee = wantsDelivery ? Math.max(0, Number(deliveryFee) || 0) : 0;
  const total = rentalTotal + fee;

  const methods: { id: CartPaymentMethod; icon: React.ReactNode; hint: string }[] = [
    {
      id: 'zain_cash',
      icon: <CreditCard size={20} />,
      hint: 'تحويل عبر زين كاش — يُراجع الشريك/الإدارة',
    },
    {
      id: 'asia_hawala',
      icon: <Banknote size={20} />,
      hint: 'حوالة محلية — يُراجع الشريك/الإدارة',
    },
    {
      id: 'manual',
      icon: <Info size={20} />,
      hint: 'تحويل بنكي مع إرسال وصل لاحقاً',
    },
    {
      id: 'cash_on_delivery',
      icon: <Truck size={20} />,
      hint: 'تدفع عند استلام المعدة',
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="booking-modal">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold">حجز المعدات</h3>
          <button type="button" data-testid="booking-modal-close" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img src={equipment.image} className="w-20 h-20 rounded-xl object-cover" alt="" />
                <div>
                  <h4 className="font-bold text-slate-800">{equipment.title}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {equipment.location}
                  </p>
                  <p className="text-blue-600 font-bold mt-1">{equipment.price.toLocaleString()} د.ع / يوم</p>
                  {(Number(equipment.rating) > 0 || Number(equipment.reviews) > 0) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {Number(equipment.rating || 0).toFixed(1)} ({Number(equipment.reviews || 0)} تقييم)
                    </p>
                  )}
                </div>
              </div>

              {reviews.length > 0 && (
                <div className="space-y-2" data-testid="booking-reviews-list">
                  <h5 className="text-sm font-bold text-slate-700">آراء المستأجرين</h5>
                  {reviews.map((r) => (
                    <div key={r.id} className="border border-slate-100 rounded-xl p-3 bg-white">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-700">{r.reviewer_name || 'مستأجر'}</span>
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <Star size={10} className="fill-amber-400 text-amber-400" /> {r.rating}
                        </span>
                      </div>
                      {r.comment && <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    data-testid="booking-start-today"
                    checked={startToday}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setStartToday(on);
                      if (on) setStartDate(todayIso());
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-800">الاستلام اليوم</div>
                    <div className="text-[11px] text-slate-400">إذا أشّرت صح = تاريخ الاستلام هو اليوم تلقائياً</div>
                  </div>
                </label>

                {!startToday && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 mr-2">تاريخ الاستلام</label>
                    <div className="relative">
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="date"
                        data-testid="booking-date-start"
                        value={startDate}
                        min={todayIso()}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">عدد أيام الإيجار</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    data-testid="booking-days"
                    value={dayCount}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    onChange={(e) => {
                      const n = Math.floor(Number(e.target.value));
                      if (!Number.isFinite(n)) {
                        setDayCount(1);
                        return;
                      }
                      setDayCount(Math.min(365, Math.max(1, n)));
                    }}
                  />
                  <p className="text-[11px] text-slate-400">مثال: 3 أيام → يُحسب تاريخ الإرجاع تلقائياً</p>
                </div>

                <div
                  className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50 space-y-2"
                  data-testid="booking-return-auto"
                >
                  <div className="flex items-center gap-2 text-emerald-800 text-sm font-bold">
                    <Calendar size={16} />
                    تاريخ الإرجاع (تلقائي)
                  </div>
                  <div className="text-lg font-bold text-emerald-900" data-testid="booking-date-end-display">
                    {formatArDate(endDate)}
                  </div>
                  <div className="text-[11px] text-emerald-700/80">
                    من {formatArDate(effectiveStart)} · لمدة {dayCount} {dayCount === 1 ? 'يوم' : 'أيام'}
                  </div>
                  {/* قيمة مخفية للاختبارات والتوافق */}
                  <input type="hidden" data-testid="booking-date-end" value={endDate} readOnly />
                </div>
              </div>

              {days > 0 && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">مدة الإيجار:</span>
                    <span className="font-bold">{days} أيام</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-blue-200 pt-2">
                    <span className="text-blue-800">مجموع الإيجار:</span>
                    <span className="text-blue-600">{rentalTotal.toLocaleString()} د.ع</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                data-testid="booking-confirm-step1"
                disabled={days <= 0 || !effectiveStart || !endDate}
                onClick={() => setStep(2)}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                تأكيد الموعد والمتابعة
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h4 className="text-lg font-bold">التوصيل وطريقة الدفع</h4>
                <p className="text-sm text-slate-500 mt-2">اختر طريقة الدفع (إلزامي) قبل إضافة الطلب للسلة.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">التوصيل</label>
                <button
                  type="button"
                  data-testid="booking-delivery-toggle"
                  onClick={() => setWantsDelivery((v) => !v)}
                  className={`w-full p-4 border rounded-2xl flex items-center justify-between transition-all ${
                    wantsDelivery ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3 text-right">
                    <Truck size={20} className={wantsDelivery ? 'text-blue-600' : 'text-slate-400'} />
                    <div>
                      <div className="text-sm font-bold">أريد توصيل المعدة</div>
                      <div className="text-[10px] text-slate-400">
                        {Number(deliveryFee) > 0
                          ? `رسوم التوصيل: ${Number(deliveryFee).toLocaleString()} د.ع (يحددها الشريك)`
                          : 'الشريك لم يضع رسوم توصيل — حالياً مجاني (0)'}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${wantsDelivery ? 'text-blue-600' : 'text-slate-400'}`}>
                    {wantsDelivery ? 'مفعّل' : 'غير مفعّل'}
                  </span>
                </button>
              </div>

              <div className="space-y-3" data-testid="booking-payment-methods">
                {methods.map((m) => {
                  const selected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`booking-pay-${m.id}`}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`w-full p-4 border rounded-2xl flex items-center justify-between transition-all ${
                        selected ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {m.icon}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{paymentMethodLabel(m.id)}</div>
                          <div className="text-[10px] text-slate-400">{m.hint}</div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>الإيجار</span>
                  <span className="font-bold">{rentalTotal.toLocaleString()} د.ع</span>
                </div>
                {wantsDelivery && (
                  <div className="flex justify-between text-slate-600">
                    <span>التوصيل</span>
                    <span className="font-bold">{fee.toLocaleString()} د.ع</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2">
                  <span>الإجمالي</span>
                  <span className="text-blue-600">{total.toLocaleString()} د.ع</span>
                </div>
              </div>

              <button
                type="button"
                data-testid="booking-confirm-final"
                disabled={!paymentMethod}
                onClick={() => {
                  if (!paymentMethod) return;
                  onConfirm({
                    dates: { start: effectiveStart, end: endDate },
                    total,
                    rentalTotal,
                    deliveryFee: fee,
                    paymentMethod,
                    wantsDelivery,
                  });
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paymentMethod ? 'إضافة للسلة' : 'اختر طريقة الدفع أولاً'}
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-slate-400 text-sm font-medium">
                رجوع
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
