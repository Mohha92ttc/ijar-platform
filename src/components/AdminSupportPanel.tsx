import React, { useCallback, useEffect, useState } from 'react';
import { Headphones, RefreshCw } from 'lucide-react';
import { apiJson, ApiError } from '../lib/api';

type SupportMsg = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  status: string;
  admin_notes?: string | null;
  created_at: string;
};

const CATEGORY_AR: Record<string, string> = {
  general: 'عام',
  technical: 'فني',
  suggestion: 'اقتراح',
  complaint: 'شكوى',
  billing: 'دفع',
};

export default function AdminSupportPanel() {
  const [rows, setRows] = useState<SupportMsg[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiJson<SupportMsg[]>('/api/support/messages');
      setRows(list);
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
      await apiJson(`/api/support/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر التحديث');
    }
  };

  const saveNote = async (id: string, current?: string | null) => {
    const note = prompt('ملاحظات الإدارة', current || '');
    if (note == null) return;
    try {
      await apiJson(`/api/support/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ admin_notes: note, status: 'in_progress' }),
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر الحفظ');
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-support-panel">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Headphones size={18} className="text-blue-600" /> رسائل الدعم
        </h3>
        <button
          type="button"
          onClick={load}
          className="text-xs font-bold text-blue-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50"
        >
          <RefreshCw size={14} /> تحديث
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">جاري التحميل…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl p-6 text-center">
          لا رسائل بعد — تظهر هنا طلبات صفحة المساعدة.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((m) => (
          <div
            key={m.id}
            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2"
            data-testid="admin-support-row"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-bold text-slate-800">{m.name}</p>
                <p className="text-xs text-slate-500">
                  {m.email} · {CATEGORY_AR[m.category] || m.category} ·{' '}
                  {new Date(m.created_at).toLocaleString('ar-IQ')}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  m.status === 'resolved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : m.status === 'in_progress'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {m.status === 'resolved' ? 'محلولة' : m.status === 'in_progress' ? 'قيد المتابعة' : 'مفتوحة'}
              </span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.message}</p>
            {m.admin_notes && (
              <p className="text-xs text-blue-800 bg-blue-50 rounded-xl px-3 py-2">ملاحظة: {m.admin_notes}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-100"
                onClick={() => setStatus(m.id, 'in_progress')}
              >
                قيد المتابعة
              </button>
              <button
                type="button"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100"
                onClick={() => setStatus(m.id, 'resolved')}
              >
                تم الحل
              </button>
              <button
                type="button"
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700"
                onClick={() => saveNote(m.id, m.admin_notes)}
              >
                ملاحظة
              </button>
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent('رد إيجار على طلبك')}`}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100"
              >
                رد بالبريد
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
