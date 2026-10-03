import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CreditCard, DollarSign, Calendar, CheckCircle, XCircle, Clock, Search, Filter, Download, Eye } from 'lucide-react';
import { Payment } from '../types';
import { apiJson, ApiError } from '../lib/api';

export default function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

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

  const addManualPayment = () => {
    alert(
      'لإضافة دفعة شريك (إعلان مميز / تجديد): من حساب الشريك → الإعلان المميز أو الاشتراك. للمراجعة: تبويب موافقات الدفع وكشوف الحسابات.'
    );
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
      case 'under_review': return 'bg-amber-100 text-amber-700';
      case 'failed':
      case 'rejected': return 'bg-red-100 text-red-700';
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
      case 'failed':
      case 'rejected': return 'فشل / مرفوض';
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
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="بحث عن دفعة..." 
              className="bg-slate-50 border border-slate-200 rounded-lg py-2 pr-10 pl-4 text-sm outline-none w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200">
            <Filter size={16} />
            تصفية
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={addManualPayment}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
          >
            <CreditCard size={16} />
            إضافة دفعة يدوية
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200">
            <Download size={16} />
            تصدير
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
              {payments.map((payment) => (
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
                      {payment.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => updatePaymentStatus(payment.id, true)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                            title="تأكيد الدفع"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button 
                            onClick={() => updatePaymentStatus(payment.id, false)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="فشل الدفع"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
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
            className="bg-white rounded-2xl p-6 max-w-md w-full"
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
              <div className="flex justify-between">
                <span className="text-slate-600">الوصف:</span>
                <span>{selectedPayment.description}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedPayment(null)}
              className="w-full mt-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              إغلاق
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
