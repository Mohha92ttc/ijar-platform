import React, { useCallback, useEffect, useState } from 'react';
import { Package, EyeOff, Wrench, CheckCircle, RefreshCw } from 'lucide-react';
import { apiJson, ApiError } from '../lib/api';

type AdminEquipment = {
  id: string;
  title: string;
  category?: string;
  status: string;
  price_per_day?: number;
  location?: string;
  owner_name?: string;
};

export default function AdminEquipmentPanel() {
  const [rows, setRows] = useState<AdminEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<AdminEquipment[]>('/api/admin/equipment');
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
    try {
      await apiJson(`/api/admin/equipment/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر التحديث');
    }
  };

  const filtered = rows.filter((e) => {
    const hay = `${e.title || ''} ${e.owner_name || ''} ${e.category || ''} ${e.status}`.toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="space-y-4" data-testid="admin-equipment-panel">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Package size={20} className="text-blue-600" /> إشراف المعدات
        </h3>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث…"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            data-testid="admin-equipment-search"
          />
          <button type="button" onClick={load} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
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
              <th className="p-3">الشريك</th>
              <th className="p-3">التصنيف</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">السعر/يوم</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-slate-100" data-testid="admin-equipment-row">
                <td className="p-3 font-bold">{e.title}</td>
                <td className="p-3">{e.owner_name || '—'}</td>
                <td className="p-3 text-xs">{e.category || '—'}</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100">{e.status}</span>
                </td>
                <td className="p-3">{Number(e.price_per_day || 0).toLocaleString()} د.ع</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      title="إظهار / متاح"
                      className="p-1.5 text-green-700 hover:bg-green-50 rounded-lg"
                      onClick={() => setStatus(e.id, 'available')}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button
                      type="button"
                      title="صيانة"
                      className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg"
                      onClick={() => setStatus(e.id, 'maintenance')}
                    >
                      <Wrench size={16} />
                    </button>
                    <button
                      type="button"
                      title="إخفاء"
                      className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg"
                      onClick={() => setStatus(e.id, 'hidden')}
                    >
                      <EyeOff size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  لا توجد معدات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
