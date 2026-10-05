import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
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
};

const statusLabel: Record<string, string> = {
  pending: 'بانتظار',
  confirmed: 'مؤكد',
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

  const setStatus = async (id: string, status: string) => {
    if (!confirm(`تغيير حالة الحجز إلى «${statusLabel[status] || status}»؟`)) return;
    try {
      await apiJson(`/api/admin/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر التحديث');
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
          <Calendar size={20} className="text-blue-600" /> حجوزات المنصة
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
              <th className="p-3">إجراءات</th>
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
                  <div className="flex flex-wrap gap-1">
                    {b.status === 'pending' && (
                      <button
                        type="button"
                        className="p-1.5 text-green-700 hover:bg-green-50 rounded-lg"
                        title="تأكيد"
                        onClick={() => setStatus(b.id, 'confirmed')}
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {['pending', 'confirmed'].includes(b.status) && (
                      <button
                        type="button"
                        className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg"
                        title="إلغاء"
                        onClick={() => setStatus(b.id, 'cancelled')}
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-lg"
                        onClick={() => setStatus(b.id, 'completed')}
                      >
                        إكمال
                      </button>
                    )}
                  </div>
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
