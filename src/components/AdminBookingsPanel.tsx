import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, XCircle, RefreshCw } from 'lucide-react';
import { apiJson, ApiError } from '../lib/api';

type AdminBooking = {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  total_amount?: number;
  customer_name?: string;
  equipment_title?: string;
  delivery_requested?: boolean;
  delivery_status?: string | null;
  return_requested?: boolean;
  return_status?: string | null;
  cancel_reason?: string | null;
};

const statusLabel: Record<string, string> = {
  pending: 'بانتظار الشريك',
  confirmed: 'مؤكد (الشريك)',
  cancelled: 'ملغي',
  completed: 'مكتمل',
};

const deliveryAr: Record<string, string> = {
  pending_assign: 'بانتظار تعيين',
  assigned: 'معيّن',
  out_for_delivery: 'قيد التوصيل',
  delivered: 'تم التسليم',
  failed: 'فشل',
};

export default function AdminBookingsPanel() {
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<AdminBooking[]>('/api/admin/bookings');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** طوارئ فقط — تأكيد/إكمال الحجز عمل الشريك */
  const emergencyCancel = async (id: string) => {
    const reason = window.prompt(
      'إلغاء طارئ (يتطلب تواصلاً مع الشريك/الزبون). اكتب السبب الذي سيظهر للزبون:',
      'إلغاء إداري بعد تواصل مع الشريك'
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      alert('سبب الإلغاء مطلوب');
      return;
    }
    if (!confirm('تأكيد الإلغاء الطارئ؟ لن يُؤكَّد أو يُكمَّل الحجز من هنا — ذلك من لوحة الشريك.')) return;
    try {
      await apiJson(`/api/admin/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled', reason: trimmed }),
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر الإلغاء');
    }
  };

  const filtered = rows.filter((b) => {
    const hay = `${b.equipment_title || ''} ${b.customer_name || ''} ${b.status}`.toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="space-y-4" data-testid="admin-bookings-panel">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar size={20} className="text-blue-600" /> متابعة الحجوزات
        </h3>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث…"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            data-testid="admin-bookings-search"
          />
          <button
            type="button"
            onClick={load}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
            title="تحديث"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3" data-testid="admin-bookings-role-hint">
        التأكيد والإكمال ورفض الحجز اليومي من عمل الشريك. الأدمن يتدخل فقط بإلغاء طارئ عند نزاع أو طلب صريح.
      </p>
      {loading && <p className="text-sm text-slate-500">جاري التحميل…</p>}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">المعدة</th>
              <th className="p-3">الزبون</th>
              <th className="p-3">التواريخ</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">التوصيل</th>
              <th className="p-3">طوارئ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-slate-100" data-testid="admin-booking-row">
                <td className="p-3 font-bold">{b.equipment_title || '—'}</td>
                <td className="p-3">{b.customer_name || '—'}</td>
                <td className="p-3 text-xs text-slate-600">
                  {new Date(b.start_date).toLocaleDateString('ar-IQ')} –{' '}
                  {new Date(b.end_date).toLocaleDateString('ar-IQ')}
                </td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100">
                    {statusLabel[b.status] || b.status}
                  </span>
                  {b.cancel_reason && (
                    <p className="text-[10px] text-red-600 mt-1 max-w-[160px]">{b.cancel_reason}</p>
                  )}
                </td>
                <td className="p-3 text-xs space-y-1">
                  {b.delivery_requested ? (
                    <div>توصيل: {deliveryAr[String(b.delivery_status || '')] || b.delivery_status || 'مطلوب'}</div>
                  ) : (
                    <span>—</span>
                  )}
                  {b.return_requested && (
                    <div className="text-violet-700">
                      استرجاع: {deliveryAr[String(b.return_status || '')] || b.return_status || 'مطلوب'}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {['pending', 'confirmed'].includes(b.status) ? (
                    <button
                      type="button"
                      data-testid="admin-booking-emergency-cancel"
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100"
                      title="إلغاء طارئ"
                      onClick={() => emergencyCancel(b.id)}
                    >
                      <XCircle size={14} /> إلغاء طارئ
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  لا توجد حجوزات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
