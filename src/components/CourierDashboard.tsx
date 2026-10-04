import React, { useCallback, useEffect, useState } from 'react';
import { Truck, MapPin, Phone, Navigation, CheckCircle, Package, BarChart2, Home, RefreshCw } from 'lucide-react';
import { apiJson } from '../lib/api';
import { googleMapsDirectionsUrl } from './MapPicker';

type CourierBooking = {
  id: string;
  equipment_title?: string;
  customer_name?: string;
  customer_user_phone?: string;
  customer_phone?: string;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_address?: string | null;
  location?: string | null;
  delivery_status?: string | null;
  delivery_fee?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
};

function statusLabel(s?: string | null) {
  switch (s) {
    case 'assigned':
      return 'معيّن';
    case 'out_for_delivery':
      return 'قيد التوصيل';
    case 'delivered':
      return 'تم التسليم';
    case 'failed':
      return 'فشل';
    case 'pending_assign':
      return 'بانتظار التعيين';
    default:
      return s || '—';
  }
}

export default function CourierDashboard({ onBack }: { onBack: () => void }) {
  const [bookings, setBookings] = useState<CourierBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name?: string; phone?: string } | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<{
    delivered_count: number;
    total_delivery_fees: number;
    by_status: Record<string, number>;
    items: any[];
  } | null>(null);
  const [tab, setTab] = useState<'orders' | 'report'>('orders');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiJson<any>('/api/couriers/me/profile');
      setProfile(me);
      const rows = await apiJson<CourierBooking[]>('/api/couriers/me/bookings');
      setBookings(rows);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    try {
      const r = await apiJson<any>(`/api/couriers/me/report?month=${encodeURIComponent(month)}`);
      setReport(r);
    } catch {
      setReport(null);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'report') loadReport();
  }, [tab, loadReport]);

  const setStatus = async (bookingId: string, delivery_status: string) => {
    try {
      await apiJson(`/api/couriers/me/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ delivery_status }),
      });
      await load();
      if (tab === 'report') await loadReport();
    } catch (e: any) {
      alert(e?.message || 'تعذر تحديث الحالة');
    }
  };

  const openRoute = (b: CourierBooking) => {
    const lat = Number(b.delivery_lat);
    const lng = Number(b.delivery_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert('لا توجد إحداثيات لهذا الطلب');
      return;
    }
    window.open(googleMapsDirectionsUrl(lat, lng), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="courier-dashboard">
      <header className="bg-emerald-800 text-white px-4 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Truck size={20} /> لوحة المندوب
          </h1>
          <p className="text-emerald-100 text-xs mt-0.5">
            {profile?.name || 'مندوب'} {profile?.phone ? `· ${profile.phone}` : ''}
          </p>
        </div>
        <button
          type="button"
          data-testid="courier-back-home"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded-xl"
        >
          <Home size={16} /> الرئيسية
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="courier-tab-orders"
            onClick={() => setTab('orders')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${
              tab === 'orders' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <Package size={16} /> طلباتي
          </button>
          <button
            type="button"
            data-testid="courier-tab-report"
            onClick={() => setTab('report')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${
              tab === 'report' ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            <BarChart2 size={16} /> تقرير الشهر
          </button>
        </div>

        {tab === 'orders' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">{loading ? 'جاري التحميل…' : `${bookings.length} طلب`}</p>
              <button
                type="button"
                onClick={load}
                className="text-xs font-bold text-emerald-700 flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-lg"
              >
                <RefreshCw size={14} /> تحديث
              </button>
            </div>

            {!loading && bookings.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                لا توجد طلبات معيّنة لك حالياً
              </div>
            )}

            {bookings.map((b) => {
              const phone = b.customer_phone || b.customer_user_phone || '—';
              const addr = b.delivery_address || b.location || '—';
              return (
                <div
                  key={b.id}
                  data-testid="courier-booking-card"
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800">{b.equipment_title || 'طلب توصيل'}</h3>
                      <p className="text-xs text-slate-500 mt-1">{b.customer_name}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      {statusLabel(b.delivery_status)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="flex items-center gap-1">
                      <MapPin size={12} /> {addr}
                    </p>
                    <p className="flex items-center gap-1">
                      <Phone size={12} /> {phone}
                    </p>
                    {b.delivery_fee != null && Number(b.delivery_fee) > 0 && (
                      <p>أجرة التوصيل: {Number(b.delivery_fee).toLocaleString()} د.ع</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="courier-open-route"
                      onClick={() => openRoute(b)}
                      className="flex-1 min-w-[140px] bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700"
                    >
                      <Navigation size={16} /> افتح الطريق
                    </button>
                    {b.delivery_status !== 'out_for_delivery' && b.delivery_status !== 'delivered' && (
                      <button
                        type="button"
                        data-testid="courier-start-delivery"
                        onClick={() => setStatus(b.id, 'out_for_delivery')}
                        className="px-3 py-2.5 rounded-xl text-sm font-bold border border-amber-200 text-amber-800 bg-amber-50"
                      >
                        بدء التوصيل
                      </button>
                    )}
                    {b.delivery_status !== 'delivered' && (
                      <button
                        type="button"
                        data-testid="courier-mark-delivered"
                        onClick={() => setStatus(b.id, 'delivered')}
                        className="px-3 py-2.5 rounded-xl text-sm font-bold border border-green-200 text-green-800 bg-green-50 flex items-center gap-1"
                      >
                        <CheckCircle size={14} /> تم التسليم
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'report' && (
          <div className="space-y-4" data-testid="courier-monthly-report">
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-slate-600">الشهر</label>
              <input
                type="month"
                data-testid="courier-report-month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            {report ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">تم التسليم</p>
                    <p className="text-2xl font-bold text-emerald-700">{report.delivered_count}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">أجور التوصيل (مسلَّم)</p>
                    <p className="text-xl font-bold text-slate-800">
                      {Number(report.total_delivery_fees || 0).toLocaleString()} د.ع
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-bold mb-2">حسب الحالة</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {Object.entries(report.by_status || {}).map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span>{statusLabel(k)}</span>
                        <span className="font-bold">{v}</span>
                      </li>
                    ))}
                    {Object.keys(report.by_status || {}).length === 0 && (
                      <li className="text-slate-400">لا بيانات لهذا الشهر</li>
                    )}
                  </ul>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-3">المعدة</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">الأجرة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.items || []).map((it: any) => (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="p-3">{it.equipment_title}</td>
                          <td className="p-3">{statusLabel(it.delivery_status)}</td>
                          <td className="p-3">{Number(it.delivery_fee || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">جاري تحميل التقرير…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
