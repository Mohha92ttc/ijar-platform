import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertCircle, Eye, Download, MessageCircle, Clock, DollarSign, CreditCard, Banknote, Smartphone, Save } from 'lucide-react';
import { Payment } from '../types';
import { apiJson, ApiError } from '../lib/api';

type Props = { filterType?: string };

export default function PaymentApproval({ filterType }: Props) {
  const [requests, setRequests] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Payment[]>('/api/admin/payments');
      setRequests(data.map(p => ({
        ...p,
        id: String(p.id)
      })));
    } catch (err) {
      setError('فشل تحميل طلبات الدفع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [selectedRequest, setSelectedRequest] = useState<Payment | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'bank': return <Banknote className="text-blue-600" size={16} />;
      case 'visa': return <CreditCard className="text-green-600" size={16} />;
      case 'cash': return <Smartphone className="text-amber-600" size={16} />;
      default: return <DollarSign className="text-slate-600" size={16} />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'bank': return 'تحويل بنكي';
      case 'visa': return 'بطاقة فيزا';
      case 'cash': return 'دفع نقدي';
      default: return method;
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'featured_promotion':
        return 'إعلان مميز (مدفوع)';
      case 'subscription_renewal':
        return 'تجديد اشتراك';
      case 'subscription':
        return 'اشتراك';
      case 'booking':
        return 'دفع حجز';
      case 'monthly':
        return 'شهري';
      case 'quarterly':
        return 'ربع سنوي';
      case 'yearly':
        return 'سنوي';
      default:
        return type || '—';
    }
  };

  const visibleRequests = useMemo(() => {
    if (!filterType) return requests;
    return requests.filter((r) => (r as Payment & { type?: string }).type === filterType);
  }, [requests, filterType]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'موافق عليه';
      case 'rejected': return 'مرفوض';
      case 'under_review': return 'قيد المراجعة';
      case 'proof_uploaded': return 'إثبات مرفوع';
      default: return 'في الانتظار';
    }
  };

  const handleDownloadImage = (imageUrl: string, partnerName: string, requestId: string) => {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `payment_proof_${partnerName}_${requestId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveImage = (imageUrl: string, requestId: string) => {
    // In a real app, this would save to server/database
    // For now, we'll simulate saving and show success message
    const savedImages = JSON.parse(localStorage.getItem('savedPaymentProofs') || '[]');
    savedImages.push({
      requestId,
      imageUrl,
      savedAt: new Date().toISOString()
    });
    localStorage.setItem('savedPaymentProofs', JSON.stringify(savedImages));
    alert('تم حفظ صورة إثبات الدفع بنجاح!');
  };

  const handleApprove = async (requestId: string) => {
    try {
      await apiJson(`/api/admin/payments/${requestId}/review`, {
        method: 'POST',
        body: JSON.stringify({ approve: true })
      });
      alert('تم الموافقة على الدفعة بنجاح');
      fetchData();
      setSelectedRequest(null);
    } catch (err) {
      alert('فشل الموافقة على الدفعة');
    }
  };

  const handleReject = async () => {
    if (selectedRequest && rejectionReason.trim()) {
      try {
        await apiJson(`/api/admin/payments/${selectedRequest.id}/review`, {
          method: 'POST',
          body: JSON.stringify({ approve: false, notes: rejectionReason.trim() })
        });
        alert('تم رفض الدفعة');
        fetchData();
        setSelectedRequest(null);
        setShowRejectModal(false);
        setRejectionReason('');
      } catch (err) {
        alert('فشل معالجة الرفض');
      }
    }
  };

  const pendingCount = visibleRequests.filter((r) => ['pending', 'under_review', 'proof_uploaded'].includes(r.status)).length;
  const approvedCount = visibleRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = visibleRequests.filter((r) => r.status === 'rejected').length;
  const totalRevenue = visibleRequests.filter((r) => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0);

  const canAct = (status: string) => ['pending', 'under_review', 'proof_uploaded'].includes(status);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
              <Clock size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">في الانتظار</span>
          </div>
          <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">موافق عليه</span>
          </div>
          <div className="text-3xl font-bold text-green-600">{approvedCount}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
              <XCircle size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">مرفوض</span>
          </div>
          <div className="text-3xl font-bold text-red-600">{rejectedCount}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <span className="text-slate-500 text-sm font-medium">إجمالي الإيرادات</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">{totalRevenue.toLocaleString()} د.ع</div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold" data-testid="payment-approval-heading">
            {filterType === 'featured_promotion' ? 'طلبات الإعلان المميز' : 'طلبات الدفع المنتظرة'}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-sm font-bold text-slate-600">الشريك</th>
                <th className="p-4 text-sm font-bold text-slate-600">نوع الطلب</th>
                <th className="p-4 text-sm font-bold text-slate-600">المبلغ</th>
                <th className="p-4 text-sm font-bold text-slate-600">طريقة الدفع</th>
                <th className="p-4 text-sm font-bold text-slate-600">تاريخ التقديم</th>
                <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                <th className="p-4 text-sm font-bold text-slate-600">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{request.user_name || 'غير معروف'}</div>
                    <div className="text-sm text-slate-500">{request.user_email || ''}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-600">{getRequestTypeLabel((request as Payment & { type?: string }).type || '')}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{Number(request.amount).toLocaleString()} د.ع</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getPaymentMethodIcon(request.method)}
                      <span className="text-sm text-slate-600">{getPaymentMethodLabel(request.method)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-600">{new Date(request.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${getStatusColor(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedRequest(request)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="عرض التفاصيل"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && !showRejectModal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRequest(null)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold">تفاصيل طلب الدفع</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Partner Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-lg">معلومات الشريك</h4>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">الاسم:</span>
                    <span className="font-bold">{selectedRequest.user_name || 'غير معروف'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">البريد:</span>
                    <span className="font-bold">{selectedRequest.user_email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">الهاتف:</span>
                    <span className="font-bold">{selectedRequest.user_phone || '-'}</span>
                  </div>
                </div>

                {/* Payment Information */}
                <h4 className="font-bold text-lg">معلومات الدفع</h4>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">نوع الطلب:</span>
                    <span className="font-bold">{getRequestTypeLabel((selectedRequest as Payment & { type?: string }).type || '')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">المبلغ:</span>
                    <span className="font-bold text-blue-600">{selectedRequest.amount.toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">طريقة الدفع:</span>
                    <div className="flex items-center gap-2">
                      {getPaymentMethodIcon(selectedRequest.method)}
                      <span className="font-bold">{getPaymentMethodLabel(selectedRequest.method)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">تاريخ التقديم:</span>
                    <span className="font-bold">{new Date(selectedRequest.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Proof */}
              <div className="space-y-4">
                <h4 className="font-bold text-lg">إثبات الدفع</h4>
                <div className="bg-slate-50 rounded-xl p-4">
                  {selectedRequest.payment_proof ? (
                  <img
                    src={selectedRequest.payment_proof}
                    alt="إثبات الدفع"
                    className="w-full h-64 object-contain rounded-lg mb-4"
                  />
                  ) : (
                    <p className="text-sm text-slate-500">لا توجد صورة مرفوعة</p>
                  )}
                  <div className="flex gap-3 flex-wrap">
                    {selectedRequest.payment_proof && (
                    <button 
                      onClick={() => handleDownloadImage(selectedRequest.payment_proof!, selectedRequest.user_name || 'user', selectedRequest.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      <Download size={16} />
                      تحميل الصورة
                    </button>
                    )}
                    {selectedRequest.payment_proof && (
                    <button 
                      onClick={() => handleSaveImage(selectedRequest.payment_proof!, selectedRequest.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      <Save size={16} />
                      حفظ في النظام
                    </button>
                    )}
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
                      <Eye size={16} />
                      تكبير
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    <p>• تحميل: حفظ الصورة على جهاز الكمبيوتر</p>
                    <p>• حفظ: تخزين الصورة في قاعدة بيانات النظام</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Information */}
            {selectedRequest && ['approved', 'rejected'].includes(selectedRequest.status) && (
              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <h4 className="font-bold mb-3">معلومات المعالجة</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">الحالة:</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${getStatusColor(selectedRequest.status)}`}>
                      {getStatusLabel(selectedRequest.status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">المعالج بواسطة:</span>
                    <span className="font-bold">{selectedRequest.processed_by || 'غير محدد'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">وقت المعالجة:</span>
                    <span className="font-bold">{selectedRequest.processed_at ? new Date(selectedRequest.processed_at).toLocaleString() : 'غير محدد'}</span>
                  </div>
                  {selectedRequest.rejection_reason && (
                    <div className="md:col-span-2">
                      <span className="text-slate-600">سبب الرفض:</span>
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {selectedRequest.rejection_reason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {selectedRequest && canAct(selectedRequest.status) && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleApprove(selectedRequest.id)}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700"
                >
                  <CheckCircle size={16} />
                  موافقة وتفعيل الحساب
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700"
                >
                  <XCircle size={16} />
                  رفض الطلب
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedRequest && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRejectModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="text-red-600" size={24} />
              <h3 className="text-lg font-bold">رفض طلب الدفع</h3>
            </div>
            
            <p className="text-slate-600 mb-4">
              يرجى تحديد سبب رفض طلب الدفع لـ <span className="font-bold">{selectedRequest.user_name || 'غير معروف'}</span>
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="أدخل سبب الرفض..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              rows={4}
            />
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle size={16} />
                تأكيد الرفض
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
