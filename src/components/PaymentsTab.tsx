import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CreditCard, DollarSign, Calendar, CheckCircle, XCircle, Clock, Search, Download, Eye } from 'lucide-react';
import { Payment } from '../types';
import { apiJson, ApiError } from '../lib/api';

export default function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Payment[]>('/api/admin/payments');
      setPayments(data.map(p => ({
        ...p,
        id: String(p.id)
      })));
      } catch (err) {
        console.error('Failed to fetch payments', err);
        const msg = err instanceof Error ? err.message : 'فشل تحميل المدفوعات';
        alert(msg);
      } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const updatePaymentStatus = async (id: string, approve: boolean) => {
    try {
      await apiJson(`/api/admin/payments/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve })
      });
      fetchData();
    } catch (err) {
      alert('فشل تحديث حالة الدفعة');
    }
  };

  const settleRefund = async (id: string) => {
    if (!confirm('تأكيد أن الاسترداد للزبون تم يدوياً؟')) return;
    try {
      await apiJson(`/api/admin/payments/${id}/settle-refund`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'تم الاسترداد يدوياً' }),
      });
      fetchData();
      setSelectedPayment(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'فشل تأكيد الاسترداد');
    }
  };

  const filteredPayments = payments.filter((p) => {
    const q = searchQ.trim().toLowerCase();
    const statusOk = statusFilter === 'all' || String(p.status) === statusFilter;
    if (!statusOk) return false;
    if (!q) return true;
    return (
      String(p.user_name || '').toLowerCase().includes(q) ||
      String(p.user_id || '').toLowerCase().includes(q) ||
      String(p.type || '').toLowerCase().includes(q) ||
      String(p.method || '').toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const header = ['id', 'user', 'type', 'amount', 'status', 'method', 'created_at'];
    const rows = filteredPayments.map((p) =>
      [
        p.id,
        p.user_name || '',
        p.type || '',
        p.amount,
        p.status,
        p.method,
        p.created_at,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'subscription':
      case 'subscription_renewal':
        return 'اشتراك';
      case 'featured_promotion':
        return 'إعلان مميز';
      case 'commission':
        return 'عمولة';
      case 'penalty':
        return 'غرامة';
      case 'booking':
        return 'حجز';
      default:
        return type || '—';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed':
      case 'paid':
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': 
      case 'under_review':
      case 'proof_uploaded': return 'bg-amber-100 text-amber-700';
      case 'failed':
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'refunded': return 'bg-violet-100 text-violet-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'completed':
      case 'paid':
      case 'approved': return 'مكتمل';
      case 'pending': return 'قيد الانتظار';
      case 'under_review': return 'قيد المراجعة';
      case 'proof_uploaded': return 'إثبات مرفوع';
      case 'failed':
      case 'rejected': return 'فشل / مرفوض';
      case 'refunded': return 'بانتظار استرداد';
      default: return status;
    }
  };

  const totalRevenue = payments
    .filter((p) => ['paid', 'approved', 'completed'].includes(String(p.status)))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingAmount = payments
    .filter((p) => ['pending', 'under_review', 'proof_uploaded'].includes(String(p.status)))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">إجمالي الإيرادات</span>
          </div>
          <div className="text-3xl font-bold text-green-600">{totalRevenue.toLocaleString()} د.ع</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
              <Clock size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">في الانتظار</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{pendingAmount.toLocaleString()} د.ع</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">إجمالي المدفوعات</span>
          </div>
          <div className="text-3xl font-bold">{payments.length}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <div className="text-sm font-bold text-slate-500 mb-1">المدفوعات المتأخرة</div>
            <div className="text-3xl font-black text-slate-800">
              {payments.filter(p => (p.status === 'pending' || p.status === 'failed')).length}
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              data-testid="admin-payments-search"
              placeholder="بحث عن دفعة..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-2 pr-10 pl-4 text-sm outline-none w-64"
            />
          </div>
          <select
            data-testid="admin-payments-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 border-0"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="under_review">قيد المراجعة</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
            <option value="refunded">بانتظار استرداد</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200"
          >
            <Download size={16} />
            تصدير CSV
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-sm font-bold text-slate-600">الشريك</th>
                <th className="p-4 text-sm font-bold text-slate-600">النوع</th>
                <th className="p-4 text-sm font-bold text-slate-600">المبلغ</th>
                <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                <th className="p-4 text-sm font-bold text-slate-600">طريقة الدفع</th>
                <th className="p-4 text-sm font-bold text-slate-600">التاريخ</th>
                <th className="p-4 text-sm font-bold text-slate-600">تاريخ الاستحقاق</th>
                <th className="p-4 text-sm font-bold text-slate-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{payment.user_name || 'غير معروف'}</div>
                    <div className="text-sm text-slate-500">#{payment.user_id?.substring(0, 8)}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-slate-600">{getPaymentTypeLabel(payment.type)}</span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{Number(payment.amount).toLocaleString()} د.ع</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${getStatusColor(payment.status)}`}>
                      {getStatusLabel(payment.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-slate-600">{payment.method}</span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-600">{new Date(payment.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-600">{payment.due_date ? new Date(payment.due_date).toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedPayment(payment)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="عرض التفاصيل"
                      >
                        <Eye size={16} />
                      </button>
                      {['pending', 'under_review', 'proof_uploaded'].includes(String(payment.status)) && (
                        <>
                          <button 
                            type="button"
                            onClick={() => updatePaymentStatus(payment.id, true)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                            title="تأكيد الدفع"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => updatePaymentStatus(payment.id, false)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="رفض الدفع"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {String(payment.status) === 'refunded' && (
                        <button
                          type="button"
                          data-testid="admin-settle-refund"
                          onClick={() => settleRefund(payment.id)}
                          className="px-2 py-1 text-[10px] font-bold text-violet-800 bg-violet-50 border border-violet-100 rounded-lg"
                          title="تأكيد إتمام الاسترداد"
                        >
                          تم الاسترداد
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPayment(null)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">تفاصيل الدفعة</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="text-sm text-slate-500 mb-1">العميل / الشريك</div>
                <div className="font-bold text-slate-800">{selectedPayment.user_name || 'غير معروف'}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">المبلغ:</span>
                <span className="font-bold">{selectedPayment.amount.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">النوع:</span>
                <span>{getPaymentTypeLabel(selectedPayment.type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">الحالة:</span>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${getStatusColor(selectedPayment.status)}`}>
                  {getStatusLabel(selectedPayment.status)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600 shrink-0">الوصف:</span>
                <span className="text-left">{selectedPayment.description || selectedPayment.notes || '—'}</span>
              </div>
              {selectedPayment.payment_proof && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-sm font-bold text-slate-700 mb-2">إثبات التحويل</p>
                  <a
                    href={selectedPayment.payment_proof}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="admin-payment-proof"
                  >
                    <img
                      src={selectedPayment.payment_proof}
                      alt="إثبات الدفع"
                      className="w-full max-h-64 object-contain rounded-xl border border-slate-200 bg-slate-50"
                    />
                  </a>
                </div>
              )}
            </div>
            {['pending', 'under_review', 'proof_uploaded'].includes(String(selectedPayment.status)) && (
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    updatePaymentStatus(selectedPayment.id, true);
                    setSelectedPayment(null);
                  }}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  موافقة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updatePaymentStatus(selectedPayment.id, false);
                    setSelectedPayment(null);
                  }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                >
                  رفض
                </button>
              </div>
            )}
            {String(selectedPayment.status) === 'refunded' && (
              <button
                type="button"
                data-testid="admin-settle-refund-modal"
                onClick={() => settleRefund(selectedPayment.id)}
                className="w-full mt-4 py-2 bg-violet-700 text-white rounded-lg font-medium hover:bg-violet-800"
              >
                تأكيد إتمام الاسترداد
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedPayment(null)}
              className="w-full mt-3 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200"
            >
              إغلاق
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
