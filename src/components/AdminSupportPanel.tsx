import React, { useCallback, useEffect, useState } from 'react';
import { Headphones, RefreshCw } from 'lucide-react';
import { apiJson, ApiError } from '../lib/api';
import { toast } from '../lib/toast';

type SupportMsg = {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  status: string;
  admin_notes?: string | null;
  admin_reply?: string | null;
  customer_reply?: string | null;
  booking_id?: string | null;
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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await apiJson<SupportMsg[]>('/api/support/messages');
      setRows(list);
      const drafts: Record<string, string> = {};
      for (const m of list) {
        drafts[m.id] = m.admin_reply || m.admin_notes || '';
      }
      setReplyDrafts(drafts);
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
      toast(e instanceof ApiError ? e.message : 'تعذر التحديث');
    }
  };

  const saveReply = async (id: string) => {
    const reply = String(replyDrafts[id] || '').trim();
    if (reply.length < 2) {
      toast('اكتب رداً قبل الحفظ');
      return;
    }
    setSavingId(id);
    try {
      await apiJson(`/api/support/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          admin_notes: reply,
          admin_reply: reply,
          status: 'in_progress',
        }),
      });
      await load();
    } catch (e: unknown) {
      toast(e instanceof ApiError ? e.message : 'تعذر الحفظ');
    } finally {
      setSavingId(null);
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
            {m.booking_id && (
              <p className="text-xs text-violet-800 bg-violet-50 rounded-xl px-3 py-2 font-mono" data-testid="admin-support-booking-id">
                حجز مرتبط: {m.booking_id}
              </p>
            )}
            {(m.admin_reply || m.admin_notes) && (
              <p className="text-xs text-blue-800 bg-blue-50 rounded-xl px-3 py-2">
                رد محفوظ: {m.admin_reply || m.admin_notes}
              </p>
            )}
            {m.customer_reply && (
              <p className="text-xs text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2" data-testid="admin-support-customer-reply">
                رد الزبون: {m.customer_reply}
              </p>
            )}

            <div className="space-y-2 pt-1" data-testid="admin-support-reply-composer">
              <label className="text-[11px] font-bold text-slate-600 block">رد للإدارة (يظهر للزبون)</label>
              <textarea
                data-testid="admin-support-reply-input"
                rows={3}
                value={replyDrafts[m.id] ?? ''}
                onChange={(e) =>
                  setReplyDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                }
                placeholder="اكتب ردك هنا…"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-y min-h-[72px] focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                data-testid="admin-support-reply-save"
                disabled={savingId === m.id}
                onClick={() => saveReply(m.id)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {savingId === m.id ? 'جاري الحفظ…' : 'حفظ الرد'}
              </button>
            </div>

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
