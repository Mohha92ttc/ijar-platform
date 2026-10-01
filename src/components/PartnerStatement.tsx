import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, Clock, Users, FileText, Search } from 'lucide-react';
import { apiJson } from '../lib/api';

type PartnerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_approved: boolean;
  subscription_status: string;
  subscription_end_date?: string | null;
  total_paid: number;
  pending_amount: number;
  payment_count: number;
};

type TxRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  type: string;
  status: string;
  created_at: string;
};

type Report = {
  summary: {
    partnersCount: number;
    totalPaid: number;
    pendingAmount: number;
    pendingRequests: number;
  };
  partners: PartnerRow[];
  transactions: TxRow[];
};

function typeLabel(t: string) {
  if (t === 'featured_promotion') return 'إعلان مميز';
  if (t === 'subscription_renewal' || t === 'subscription') return 'اشتراك';
  return t;
}

function statusLabel(s: string) {
  if (s === 'approved') return 'موافق';
  if (s === 'rejected') return 'مرفوض';
  if (s === 'under_review' || s === 'pending' || s === 'proof_uploaded') return 'معلّق';
  return s;
}

export default function PartnerStatement() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiJson<Report>('/api/admin/partner-payments-report');
        setReport(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل تحميل تقرير مدفوعات الشركاء');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const partners = useMemo(() => {
    const list = report?.partners || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q)
    );
  }, [report, search]);

  const transactions = useMemo(() => {
    const list = report?.transactions || [];
    if (!selectedPartnerId) return list;
    return list.filter((t) => t.user_id === selectedPartnerId);
  }, [report, selectedPartnerId]);

  if (loading) {
    return <div className="text-slate-500 text-sm">جاري تحميل تقرير مدفوعات الشركاء…</div>;
  }
  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>;
  }

  const summary = report?.summary;

  return (
    <div className="space-y-6" data-testid="partner-payments-report">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2 text-slate-500 text-sm"><Users size={16} /> الشركاء</div>
          <div className="text-2xl font-bold">{summary?.partnersCount ?? 0}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2 text-slate-500 text-sm"><DollarSign size={16} /> إجمالي المدفوع</div>
          <div className="text-2xl font-bold text-green-600">{(summary?.totalPaid ?? 0).toLocaleString()} د.ع</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2 text-slate-500 text-sm"><Clock size={16} /> مبالغ معلّقة</div>
          <div className="text-2xl font-bold text-amber-600">{(summary?.pendingAmount ?? 0).toLocaleString()} د.ع</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-2 text-slate-500 text-sm"><FileText size={16} /> طلبات معلّقة</div>
          <div className="text-2xl font-bold text-blue-600">{summary?.pendingRequests ?? 0}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold">كشوف مدفوعات الشركاء</h3>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              data-testid="partner-payments-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن شريك…"
              className="border border-slate-200 rounded-lg py-2 pr-10 pl-3 text-sm w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 text-sm font-bold text-slate-600">الشريك</th>
                <th className="p-3 text-sm font-bold text-slate-600">الاشتراك</th>
                <th className="p-3 text-sm font-bold text-slate-600">مدفوع</th>
                <th className="p-3 text-sm font-bold text-slate-600">معلّق</th>
                <th className="p-3 text-sm font-bold text-slate-600">الطلبات</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr
                  key={p.id}
                  data-testid="partner-payment-row"
                  onClick={() => setSelectedPartnerId(selectedPartnerId === p.id ? null : p.id)}
                  className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                    selectedPartnerId === p.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="p-3">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.email}</div>
                  </td>
                  <td className="p-3 text-sm">{p.subscription_status}</td>
                  <td className="p-3 font-bold text-green-700">{p.total_paid.toLocaleString()}</td>
                  <td className="p-3 font-bold text-amber-700">{p.pending_amount.toLocaleString()}</td>
                  <td className="p-3 text-sm">{p.payment_count}</td>
                </tr>
              ))}
              {partners.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 text-sm">لا توجد بيانات شركاء</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 className="font-bold mb-3">
          سجل المدفوعات{selectedPartnerId ? ' (مصفّى حسب الشريك)' : ''}
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-3 text-sm font-bold text-slate-600">الشريك</th>
                <th className="p-3 text-sm font-bold text-slate-600">النوع</th>
                <th className="p-3 text-sm font-bold text-slate-600">المبلغ</th>
                <th className="p-3 text-sm font-bold text-slate-600">الحالة</th>
                <th className="p-3 text-sm font-bold text-slate-600">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} data-testid="partner-payment-tx" className="border-b border-slate-100">
                  <td className="p-3">
                    <div className="font-bold text-sm">{t.user_name}</div>
                    <div className="text-xs text-slate-500">{t.user_email}</div>
                  </td>
                  <td className="p-3 text-sm">{typeLabel(t.type)}</td>
                  <td className="p-3 font-bold">{Number(t.amount).toLocaleString()} د.ع</td>
                  <td className="p-3 text-sm">{statusLabel(t.status)}</td>
                  <td className="p-3 text-xs text-slate-500">{new Date(t.created_at).toLocaleString('ar-IQ')}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 text-sm">لا توجد مدفوعات شركاء بعد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
