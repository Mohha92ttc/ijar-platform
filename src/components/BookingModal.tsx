import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, ShieldCheck, CreditCard, Info, X } from 'lucide-react';

export default function BookingModal({ equipment, onClose, onConfirm }: { equipment: any, onClose: () => void, onConfirm: (data: any) => void }) {
  const [dates, setDates] = useState({ start: '', end: '' });
  const [step, setStep] = useState(1);

  const calculateDays = () => {
    if (!dates.start || !dates.end) return 0;
    const s = new Date(dates.start);
    const e = new Date(dates.end);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  };

  const days = calculateDays();
  const total = days * equipment.price;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="booking-modal">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold">حجز المعدات</h3>
          <button type="button" data-testid="booking-modal-close" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img src={equipment.image} className="w-20 h-20 rounded-xl object-cover" alt="" />
                <div>
                  <h4 className="font-bold text-slate-800">{equipment.title}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin size={12} /> {equipment.location}</p>
                  <p className="text-blue-600 font-bold mt-1">{equipment.price.toLocaleString()} د.ع / يوم</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">تاريخ الاستلام</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="date" 
                      data-testid="booking-date-start"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => setDates({...dates, start: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">تاريخ الإرجاع</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="date" 
                      data-testid="booking-date-end"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => setDates({...dates, end: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {days > 0 && (
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">مدة الإيجار:</span>
                    <span className="font-bold">{days} أيام</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-blue-200 pt-2">
                    <span className="text-blue-800">المجموع الكلي:</span>
                    <span className="text-blue-600">{total.toLocaleString()} د.ع</span>
                  </div>
                </div>
              )}

              <button 
                type="button"
                data-testid="booking-confirm-step1"
                disabled={days <= 0}
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
                <h4 className="text-lg font-bold">تأكيد الحجز والدفع</h4>
                <p className="text-sm text-slate-500 mt-2">سيتم إرسال طلبك لصاحب المعدات، يرجى تأكيد الدفع لإتمام العملية.</p>
              </div>

              <div className="space-y-3">
                <button className="w-full p-4 border border-slate-200 rounded-2xl flex items-center justify-between hover:border-blue-600 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600"><CreditCard size={20} /></div>
                    <div className="text-right">
                      <div className="text-sm font-bold">دفع إلكتروني (ZainCash / AsiaHawala)</div>
                      <div className="text-[10px] text-slate-400">تأكيد فوري للحجز</div>
                    </div>
                  </div>
                </button>
                <button className="w-full p-4 border border-slate-200 rounded-2xl flex items-center justify-between hover:border-blue-600 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600"><Info size={20} /></div>
                    <div className="text-right">
                      <div className="text-sm font-bold">تحويل يدوي (إرسال وصل)</div>
                      <div className="text-[10px] text-slate-400">يتم التأكيد بعد مراجعة الإدارة</div>
                    </div>
                  </div>
                </button>
              </div>

              <button 
                type="button"
                data-testid="booking-confirm-final"
                onClick={() => onConfirm({ dates, total })}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-600 transition-all"
              >
                تأكيد الحجز النهائي
              </button>
              <button onClick={() => setStep(1)} className="w-full text-slate-400 text-sm font-medium">رجوع</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
