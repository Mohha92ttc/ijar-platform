import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Package, Clock, CheckCircle, XCircle, Settings, Plus, BarChart2, Home, Edit2, Trash2, Save, X, Sparkles, CreditCard, Image as ImageIcon, Eye } from 'lucide-react';
import ImageUpload from './ImageUpload';
import TransferAccountsPanel from './TransferAccountsPanel';
import { apiJson, ApiError } from '../lib/api';
import { paymentMethodLabel, type CartPaymentMethod } from '../lib/cartStorage';
import { IRAQ_GOVERNORATES, GOVERNORATE_AREAS, formatEquipmentLocation } from '../lib/iraqLocations';

type Eq = {
  id: string;
  title: string;
  category: string;
  status: string;
  price: number;
  description: string;
  image: string;
};

type Bk = {
  id: string;
  equipment: string;
  customer: string;
  phone: string;
  location: string;
  dates: string;
  total: number;
  status: string;
  paymentPreference?: string;
  paymentProof?: string | null;
  paymentStatus?: string | null;
  isCod: boolean;
};

function mapPayLabel(pref?: string | null): string {
  const p = String(pref || '');
  if (p === 'zain_cash' || p === 'asia_hawala' || p === 'manual' || p === 'cash_on_delivery') {
    return paymentMethodLabel(p as CartPaymentMethod);
  }
  if (p === 'cash') return 'دفع عند التسليم';
  if (p === 'wallet') return 'زين كاش';
  if (p === 'bank') return 'تحويل بنكي / حوالة';
  return p || '—';
}

function resolveProofUrl(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/')) {
    return raw;
  }
  return `/uploads/${raw}`;
}

export default function PartnerDashboard({ ownerId, onBack }: { ownerId?: string; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('bookings');
  const [myEquipment, setMyEquipment] = useState<Eq[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const [newEquipment, setNewEquipment] = useState({
    title: '',
    category: '',
    price: '',
    description: '',
    governorate: 'بغداد',
    area: '',
    imageFile: null as File | null
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const [bookings, setBookings] = useState<Bk[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofPreview, setProofPreview] = useState<{ url: string; bookingId: string; title: string } | null>(null);

  const [transferInfo, setTransferInfo] = useState<{
    bank_name?: string | null;
    bank_account_iban?: string | null;
    card_number_display?: string | null;
    mastercard?: string | null;
    zain_cash_phone?: string | null;
    account_holder_name?: string | null;
    transfer_instructions?: string | null;
    featured_ad_price?: number;
    featured_duration_days?: number;
    subscription_renewal_price?: number;
  } | null>(null);
  const [featNotes, setFeatNotes] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [featFile, setFeatFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [myPlatformPayments, setMyPlatformPayments] = useState<any[]>([]);
  const [paySettings, setPaySettings] = useState({
    phone_number: '',
    wallet_number: '',
    bank_account: '',
    card_number: '',
    account_holder_name: '',
    delivery_fee: '0',
  });
  const [paySettingsSaving, setPaySettingsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!ownerId) {
      setMyEquipment([]);
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const equip = await apiJson<Record<string, unknown>[]>(`/api/equipment/owner/${ownerId}`);
      const mapped: Eq[] = equip.map((e) => ({
        id: String(e.id),
        title: String(e.title),
        category: String(e.category),
        status: String(e.status),
        price: Number(e.price_per_day),
        description: String(e.description || ''),
        image: Array.isArray(e.images) && (e.images as string[])[0] ? (e.images as string[])[0] : 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400',
      }));
      setMyEquipment(mapped);

      const bList = await apiJson<any[]>(`/api/bookings/owner/${ownerId}`);
      const mappedBookings: Bk[] = bList.map((b) => {
        const pref = String(b.payment_preference || '');
        const isCod = pref === 'cash_on_delivery' || String(b.payment_db_method || '') === 'cash';
        return {
          id: String(b.id),
          equipment: String(b.equipment_title || '—'),
          customer: String(b.customer_name || b.customer_id),
          phone: String(b.customer_phone ?? '—'),
          location: String(b.location ?? '—'),
          dates: `${new Date(String(b.start_date)).toLocaleDateString('ar-IQ')} – ${new Date(String(b.end_date)).toLocaleDateString('ar-IQ')}`,
          total: Number(b.total_amount),
          status: String(b.status),
          paymentPreference: pref || String(b.payment_db_method || ''),
          paymentProof: resolveProofUrl(b.payment_proof ? String(b.payment_proof) : null),
          paymentStatus: b.payment_status ? String(b.payment_status) : null,
          isCod,
        };
      });
      setBookings(mappedBookings);

      try {
        const prof = await apiJson<any>('/api/auth/me');
        setProfile(prof);
      } catch {
        // ignore
      }
    } catch {
      setMyEquipment([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!ownerId || (activeTab !== 'featured' && activeTab !== 'settings' && activeTab !== 'reports')) return;
    (async () => {
      try {
        if (activeTab === 'featured' || activeTab === 'settings') {
          const t = await apiJson<typeof transferInfo>('/api/platform/transfer-info');
          setTransferInfo(t);
        }
        if (activeTab === 'reports' || activeTab === 'featured') {
          const pays = await apiJson<any[]>('/api/payments/my-platform');
          setMyPlatformPayments(pays);
        }
        if (activeTab === 'settings') {
          const s = await apiJson<any>(`/api/payments/owner-settings/${ownerId}`);
          setPaySettings({
            phone_number: String(s.phone_number || ''),
            wallet_number: String(s.wallet_number || ''),
            bank_account: String(s.bank_account || ''),
            card_number: String(s.card_number || ''),
            account_holder_name: String(s.account_holder_name || ''),
            delivery_fee: String(s.delivery_fee ?? 0),
          });
        }
      } catch {
        if (activeTab === 'featured' || activeTab === 'settings') setTransferInfo(null);
      }
    })();
  }, [activeTab, ownerId]);

  const savePaySettings = async () => {
    if (!ownerId) return;
    try {
      setPaySettingsSaving(true);
      await apiJson('/api/payments/settings', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: paySettings.phone_number.trim() || undefined,
          wallet_number: paySettings.wallet_number.trim() || undefined,
          bank_account: paySettings.bank_account.trim() || undefined,
          card_number: paySettings.card_number.trim() || undefined,
          account_holder_name: paySettings.account_holder_name.trim() || undefined,
          delivery_fee: Math.max(0, Number(paySettings.delivery_fee) || 0),
        }),
      });
      alert('تم حفظ إعدادات الدفع والتوصيل');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setPaySettingsSaving(false);
    }
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const submitPlatformPayment = async (kind: 'featured_promotion' | 'subscription_renewal', file: File | null, notes: string) => {
    if (!ownerId || !transferInfo || !file) {
      alert(kind === 'featured_promotion' ? 'يرجى اختيار صورة إثبات التحويل' : 'يرجى اختيار صورة إثبات التحويل');
      return;
    }
    const amount =
      kind === 'featured_promotion'
        ? Number(transferInfo.featured_ad_price ?? 50000)
        : Number(transferInfo.subscription_renewal_price ?? 100000);
    try {
      setPaySubmitting(true);
      const payment_proof = await fileToDataUrl(file);
      await apiJson('/api/payments/partner-platform', {
        method: 'POST',
        body: JSON.stringify({ kind, amount, payment_proof, notes: notes.trim() || undefined }),
      });
      alert('تم إرسال الطلب. سيتم مراجعته من الإدارة قريباً.');
      setFeatNotes('');
      setSubNotes('');
      setFeatFile(null);
      setSubFile(null);
      try {
        const pays = await apiJson<any[]>('/api/payments/my-platform');
        setMyPlatformPayments(pays);
      } catch {
        // ignore
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'تعذر إرسال الطلب';
      alert(msg);
    } finally {
      setPaySubmitting(false);
    }
  };

  const updateBookingStatus = async (id: string, newStatus: string) => {
    const booking = bookings.find((b) => b.id === id);
    if (newStatus === 'confirmed' && booking && !booking.isCod && booking.paymentProof) {
      const ok = confirm('هل راجعت صورة إثبات التحويل وتأكدت من وصول المبلغ؟');
      if (!ok) return;
    }
    try {
      await apiJson(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
    } catch {
      alert('تعذر تحديث حالة الحجز');
    }
  };

  const addEquipment = async () => {
    if (!ownerId) {
      alert('تعذر تحديد هوية المالك. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }
    if (!newEquipment.title || !newEquipment.category || !newEquipment.price) {
      alert('يرجى ملء جميع الحقول المطلوبة: الاسم، التصنيف، والسعر.');
      return;
    }
    if (!newEquipment.governorate.trim()) {
      alert('يرجى اختيار المحافظة التي تتوفر فيها المعدة.');
      return;
    }
    const price = parseInt(newEquipment.price, 10);
    if (Number.isNaN(price)) {
      alert('السعر يجب أن يكون رقماً صحيحاً.');
      return;
    }

    let imageUrl = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400';
    if (newEquipment.imageFile) {
      imageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(newEquipment.imageFile!);
      });
    }

    const governorate = newEquipment.governorate.trim();
    const area = newEquipment.area.trim() || null;
    const location = formatEquipmentLocation(governorate, area);

    try {
      await apiJson('/api/equipment', {
        method: 'POST',
        body: JSON.stringify({
          title: newEquipment.title,
          description: newEquipment.description || '—',
          category: newEquipment.category,
          price_per_day: price,
          location,
          governorate,
          area,
          images: [imageUrl],
          ownerId,
        }),
      });
      setNewEquipment({ title: '', category: '', price: '', description: '', governorate: 'بغداد', area: '', imageFile: null });
      setShowAddForm(false);
      await loadData();
    } catch {
      alert('تعذر حفظ المعدة');
    }
  };

  const deleteEquipment = async (id: string) => {
    if (!ownerId) return;
    try {
      await apiJson(`/api/equipment/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ ownerId }),
      });
      await loadData();
    } catch {
      alert('تعذر حذف المعدة');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white hidden lg:flex flex-col">
        <div className="p-6 border-b border-blue-800">
          <h1 className="text-xl font-bold">لوحة تحكم الشريك</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            type="button"
            data-testid="partner-nav-bookings"
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'bookings' ? 'bg-blue-700' : 'hover:bg-blue-800 text-blue-200'
            }`}
          >
            <Clock size={18} /> الطلبات الواصلة
          </button>
          <button 
            type="button"
            data-testid="partner-nav-equipment"
            onClick={() => setActiveTab('equipment')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'equipment' ? 'bg-blue-700' : 'hover:bg-blue-800 text-blue-200'
            }`}
          >
            <Package size={18} /> معداتي
          </button>
          <button 
            type="button"
            data-testid="partner-nav-reports"
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'reports' ? 'bg-blue-700' : 'hover:bg-blue-800 text-blue-200'
            }`}
          >
            <BarChart2 size={18} /> التقارير
          </button>
          <button 
            type="button"
            data-testid="partner-nav-featured"
            onClick={() => setActiveTab('featured')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'featured' ? 'bg-blue-700' : 'hover:bg-blue-800 text-blue-200'
            }`}
          >
            <Sparkles size={18} /> إعلان مميز
          </button>
          <button 
            type="button"
            data-testid="partner-nav-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'settings' ? 'bg-blue-700' : 'hover:bg-blue-800 text-blue-200'
            }`}
          >
            <Settings size={18} /> الإعدادات
          </button>
          <button 
            type="button"
            data-testid="partner-back-home"
            onClick={onBack}
            className="w-full flex items-center gap-3 p-3 hover:bg-blue-800 rounded-xl text-sm font-bold text-blue-200 border-t border-blue-800 pt-4"
          >
            <Home size={18} /> العودة للرئيسية
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'bookings' && 'الطلبات الواصلة'}
              {activeTab === 'equipment' && 'معداتي'}
              {activeTab === 'reports' && 'التقارير'}
              {activeTab === 'featured' && 'إعلان مميز مدفوع'}
              {activeTab === 'settings' && 'الإعدادات'}
            </h2>
            <p className="text-slate-500 text-sm">
              {loading && 'جاري التحميل من الخادم…'}
              {!loading && activeTab === 'bookings' && `لديك ${bookings.filter((b) => b.status === 'pending').length} طلبات جديدة بانتظار المراجعة`}
              {!loading && activeTab === 'equipment' && `لديك ${myEquipment.length} معدة مسجلة`}
              {!loading && activeTab === 'reports' && 'إحصائيات أداء حسابك'}
              {!loading && activeTab === 'featured' && 'الظهور في مقدمة القائمة بعد الموافقة على الدفع'}
              {!loading && activeTab === 'settings' && 'إدارة معلومات حسابك'}
            </p>
          </div>
          {activeTab === 'equipment' && (
            <button 
              type="button"
              data-testid="partner-open-add-equipment"
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              <Plus size={18} /> إضافة معدة جديدة
            </button>
          )}
        </header>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Clock className="text-blue-600" size={20} /> الطلبات الأخيرة
            </h3>
            
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <motion.div 
                  key={booking.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4"
                  data-testid="partner-booking-card"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-800">{booking.equipment}</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {booking.status === 'confirmed' ? 'مثبت' : booking.status === 'cancelled' ? 'ملغي' : 'بانتظار الموافقة'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        {mapPayLabel(booking.paymentPreference)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 flex flex-wrap gap-x-6 gap-y-1">
                      <span className="flex items-center gap-1 font-medium text-slate-700 underline underline-offset-4 decoration-blue-200">{booking.customer}</span>
                      <span>الهاتف: {booking.phone}</span>
                      <span>الموقع: {booking.location}</span>
                      <span>التاريخ: {booking.dates}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="text-left md:text-right">
                      <div className="text-xs text-slate-400">المبلغ الإجمالي</div>
                      <div className="text-lg font-bold text-blue-600">{booking.total.toLocaleString()} د.ع</div>
                    </div>
                    
                    <div className="flex gap-2">
                      {booking.status === 'pending' && (
                        <>
                          <button 
                            type="button"
                            data-testid="partner-booking-approve"
                            onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="موافقة"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            type="button"
                            data-testid="partner-booking-reject"
                            onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="رفض"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  </div>

                  {/* إثبات الدفع — يراجعه الشريك قبل الموافقة */}
                  <div className="border-t border-slate-100 pt-4" data-testid="partner-booking-payment-proof">
                    {booking.isCod ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        دفع عند التسليم — لا توجد صورة تحويل. وافق على الحجز إذا كانت التواريخ والمعدة مناسبة.
                      </p>
                    ) : booking.paymentProof ? (
                      <div className="flex flex-col sm:flex-row gap-4 items-start">
                        <button
                          type="button"
                          data-testid="partner-view-proof"
                          onClick={() =>
                            setProofPreview({
                              url: booking.paymentProof!,
                              bookingId: booking.id,
                              title: booking.equipment,
                            })
                          }
                          className="relative group shrink-0"
                        >
                          <img
                            src={booking.paymentProof}
                            alt="إثبات الدفع"
                            className="w-28 h-28 object-cover rounded-xl border border-slate-200 shadow-sm"
                          />
                          <span className="absolute inset-0 rounded-xl bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                            <Eye size={16} className="ml-1" /> عرض
                          </span>
                        </button>
                        <div className="space-y-1 text-sm">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <ImageIcon size={16} className="text-blue-600" />
                            إثبات التحويل مرفق
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            اضغط على الصورة لتكبيرها وتأكد من وصول المبلغ لحسابك قبل الموافقة على الطلب.
                          </p>
                          {booking.paymentStatus && (
                            <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                              حالة الدفع: {booking.paymentStatus === 'under_review' ? 'بانتظار مراجعتك' : booking.paymentStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                        الزبون اختار تحويلاً لكن لم يُرفق إثبات دفع بعد — راجع معه قبل الموافقة.
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {proofPreview && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80"
            data-testid="partner-proof-lightbox"
            onClick={() => setProofPreview(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-auto p-4 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3 gap-3">
                <div>
                  <h4 className="font-bold text-slate-800">إثبات دفع — {proofPreview.title}</h4>
                  <p className="text-xs text-slate-500">راجع الصورة ثم أغلق ووافق أو ارفض الطلب</p>
                </div>
                <button
                  type="button"
                  data-testid="partner-proof-close"
                  onClick={() => setProofPreview(null)}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <img src={proofPreview.url} alt="إثبات الدفع" className="w-full rounded-xl border border-slate-100" />
              {bookings.find((b) => b.id === proofPreview.bookingId)?.status === 'pending' && (
                <div className="flex gap-3 mt-4 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-bold"
                    onClick={() => {
                      setProofPreview(null);
                      updateBookingStatus(proofPreview.bookingId, 'cancelled');
                    }}
                  >
                    رفض الطلب
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold"
                    onClick={() => {
                      setProofPreview(null);
                      updateBookingStatus(proofPreview.bookingId, 'confirmed');
                    }}
                  >
                    تأكيد بعد مراجعة الصورة
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="space-y-6">
            {showAddForm && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
              >
                <h3 className="text-lg font-bold mb-4">إضافة معدة جديدة</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    data-testid="partner-equipment-title"
                    placeholder="اسم المعدة"
                    value={newEquipment.title}
                    onChange={(e) => setNewEquipment({...newEquipment, title: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="text"
                    data-testid="partner-equipment-category"
                    placeholder="التصنيف"
                    value={newEquipment.category}
                    onChange={(e) => setNewEquipment({...newEquipment, category: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    data-testid="partner-equipment-price"
                    placeholder="السعر باليوم"
                    value={newEquipment.price}
                    onChange={(e) => setNewEquipment({...newEquipment, price: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">المحافظة *</label>
                    <select
                      data-testid="partner-equipment-governorate"
                      value={newEquipment.governorate}
                      onChange={(e) => setNewEquipment({ ...newEquipment, governorate: e.target.value, area: '' })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white"
                      required
                    >
                      {IRAQ_GOVERNORATES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">المنطقة (اختياري)</label>
                    <input
                      type="text"
                      list="partner-area-suggestions"
                      data-testid="partner-equipment-area"
                      placeholder="مثال: الكرادة، العشار…"
                      value={newEquipment.area}
                      onChange={(e) => setNewEquipment({ ...newEquipment, area: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm"
                    />
                    <datalist id="partner-area-suggestions">
                      {(GOVERNORATE_AREAS[newEquipment.governorate] || []).map((a) => (
                        <option key={a} value={a} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium text-slate-700">صورة المعدة</label>
                  <ImageUpload
                    onImageSelect={(file) => setNewEquipment({...newEquipment, imageFile: file})}
                    className="h-48"
                  />
                </div>
                <textarea
                  placeholder="وصف المعدة"
                  value={newEquipment.description}
                  onChange={(e) => setNewEquipment({...newEquipment, description: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none mb-4"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button 
                    type="button"
                    data-testid="partner-equipment-save"
                    onClick={addEquipment}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700"
                  >
                    <Save size={16} /> حفظ
                  </button>
                  <button 
                    type="button"
                    data-testid="partner-equipment-cancel-form"
                    onClick={() => setShowAddForm(false)}
                    className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700"
                  >
                    <X size={16} /> إلغاء
                  </button>
                </div>
              </motion.div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myEquipment.map((equipment) => (
                <motion.div 
                  key={equipment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
                >
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img src={equipment.image} alt={equipment.title} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700">
                      {equipment.category}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                        equipment.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {equipment.status === 'available' ? 'متاحة' : 'مؤجرة'}
                      </span>
                      <div className="flex gap-2">
                        <button type="button" data-testid="partner-equipment-edit" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button 
                          type="button"
                          data-testid="partner-equipment-delete"
                          onClick={() => deleteEquipment(equipment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-2">{equipment.title}</h4>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{equipment.description}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-lg font-bold text-blue-600">{equipment.price.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 mr-1">د.ع / يوم</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">إجمالي الإيرادات</div>
                <div className="text-2xl font-bold text-blue-600">
                  {bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.total, 0).toLocaleString()} د.ع
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">الطلبات المكتملة</div>
                <div className="text-2xl font-bold text-slate-800">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">الطلبات المعلقة</div>
                <div className="text-2xl font-bold text-amber-600">
                  {bookings.filter(b => b.status === 'pending').length}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6" data-testid="partner-payments-report-panel">
              <h3 className="text-lg font-bold mb-4">تقرير مدفوعاتي للمنصة</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-3 text-sm">النوع</th>
                      <th className="p-3 text-sm">المبلغ</th>
                      <th className="p-3 text-sm">الحالة</th>
                      <th className="p-3 text-sm">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPlatformPayments.map((p) => (
                      <tr key={String(p.id)} data-testid="partner-my-payment-row" className="border-b border-slate-100">
                        <td className="p-3 text-sm">{p.type === 'featured_promotion' ? 'إعلان مميز' : 'اشتراك'}</td>
                        <td className="p-3 font-bold">{Number(p.amount).toLocaleString()} د.ع</td>
                        <td className="p-3 text-sm">{String(p.status)}</td>
                        <td className="p-3 text-xs text-slate-500">{new Date(p.created_at).toLocaleString('ar-IQ')}</td>
                      </tr>
                    ))}
                    {myPlatformPayments.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-sm text-slate-500">لا توجد مدفوعات بعد</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Featured promotion Tab */}
        {activeTab === 'featured' && (
          <div className="space-y-8 max-w-3xl">
            <div data-testid="partner-transfer-info">
              <TransferAccountsPanel
                info={{
                  title: 'حوّل إلى حساب المنصة (إيجار)',
                  subtitle: 'نفس الآلية التي يستلم بها الزبون منك — ماستركارد أو زين كاش ثم ارفع إثبات التحويل.',
                  bank_name: transferInfo?.bank_name,
                  bank_account: transferInfo?.bank_account_iban,
                  mastercard: transferInfo?.mastercard || transferInfo?.card_number_display,
                  zain_cash: transferInfo?.zain_cash_phone,
                  account_holder: transferInfo?.account_holder_name,
                  instructions: transferInfo?.transfer_instructions,
                }}
              />
            </div>

            <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">طلب إعلان مميز</h3>
              <p className="text-sm text-slate-600 mb-4">
                1) حوّل المبلغ للحساب أعلاه — 2) ارفع صورة الإثبات — 3) بانتظار موافقة الإدارة.
                المدة: {transferInfo?.featured_duration_days ?? 30} يوماً — السعر:{' '}
                <span className="font-bold text-blue-600">
                  {(transferInfo?.featured_ad_price ?? 50000).toLocaleString()} د.ع
                </span>
              </p>
              <textarea
                value={featNotes}
                onChange={(e) => setFeatNotes(e.target.value)}
                placeholder="ملاحظات (اسم المحوّل، رقم العملية…)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3"
                rows={2}
              />
              <input
                type="file"
                accept="image/*"
                data-testid="partner-featured-proof"
                onChange={(e) => setFeatFile(e.target.files?.[0] ?? null)}
                className="text-sm mb-4"
              />
              <button
                type="button"
                data-testid="partner-featured-submit"
                disabled={paySubmitting}
                onClick={() => submitPlatformPayment('featured_promotion', featFile, featNotes)}
                className="bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
              >
                {paySubmitting ? 'جاري الإرسال…' : 'إرسال طلب الإعلان المميز'}
              </button>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-2">تجديد اشتراك المنصة</h3>
              <p className="text-sm text-slate-600 mb-4">
                نفس حسابات التحويل أعلاه. المبلغ:{' '}
                <span className="font-bold text-blue-600">
                  {(transferInfo?.subscription_renewal_price ?? 100000).toLocaleString()} د.ع
                </span>
              </p>
              <textarea
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                placeholder="ملاحظات اختيارية"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3"
                rows={2}
              />
              <input
                type="file"
                accept="image/*"
                data-testid="partner-subscription-proof"
                onChange={(e) => setSubFile(e.target.files?.[0] ?? null)}
                className="text-sm mb-4"
              />
              <button
                type="button"
                data-testid="partner-subscription-submit"
                disabled={paySubmitting}
                onClick={() => submitPlatformPayment('subscription_renewal', subFile, subNotes)}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {paySubmitting ? 'جاري الإرسال…' : 'إرسال طلب تجديد الاشتراك'}
              </button>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl p-8 border border-slate-200">
            <div className="text-center mb-8">
              <Settings size={48} className="mx-auto text-slate-400 mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">معلومات الحساب</h3>
            </div>

            {transferInfo && (
              <div className="max-w-4xl mx-auto mb-8" data-testid="partner-settings-transfer-info">
                <TransferAccountsPanel
                  info={{
                    title: 'حسابات المنصة (للدفع لك كشريك)',
                    subtitle: 'استخدمها عند تجديد الاشتراك أو الإعلان المميز من تبويب الإعلان.',
                    bank_name: transferInfo.bank_name,
                    bank_account: transferInfo.bank_account_iban,
                    mastercard: transferInfo.mastercard || transferInfo.card_number_display,
                    zain_cash: transferInfo.zain_cash_phone,
                    account_holder: transferInfo.account_holder_name,
                    instructions: transferInfo.transfer_instructions,
                  }}
                />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">اسم الشريك</label>
                <input type="text" value={profile?.name || '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">البريد الإلكتروني</label>
                <input type="email" value={profile?.email || '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                <input type="tel" value={profile?.phone || '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">حالة الاشتراك</label>
                <input type="text" value={profile?.subscription_status === 'active' ? 'نشط' : profile?.subscription_status === 'pending' ? 'في الانتظار' : 'غير نشط'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right font-bold text-blue-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">صلاحية الاشتراك</label>
                <input type="text" value={profile?.subscription_end_date ? new Date(profile.subscription_end_date).toLocaleDateString('ar-IQ') : '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">تاريخ الانضمام</label>
                <input type="text" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ar-IQ') : '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right" />
              </div>
            </div>

            <div className="max-w-4xl mx-auto mt-10 p-6 border border-blue-100 rounded-2xl bg-blue-50/40" data-testid="partner-delivery-payment-settings">
              <h4 className="text-lg font-bold text-slate-800 mb-2">حساباتك لاستلام دفعات الزبائن</h4>
              <p className="text-xs text-slate-500 mb-4">
                أدخل ماستركارد و/أو زين كاش — يظهران للزبون عند الحجز ليحول عليك. رسوم التوصيل اختيارية (0 مسموح).
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم صاحب الحساب</label>
                  <input
                    type="text"
                    data-testid="partner-account-holder"
                    value={paySettings.account_holder_name}
                    onChange={(e) => setPaySettings({ ...paySettings, account_holder_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-right"
                    placeholder="الاسم على البطاقة / المحفظة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">رقم ماستركارد / فيزا</label>
                  <input
                    type="text"
                    data-testid="partner-mastercard"
                    value={paySettings.card_number}
                    onChange={(e) => setPaySettings({ ...paySettings, card_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-right font-mono"
                    placeholder="XXXX XXXX XXXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">رقم زين كاش</label>
                  <input
                    type="text"
                    data-testid="partner-wallet-number"
                    value={paySettings.wallet_number}
                    onChange={(e) => setPaySettings({ ...paySettings, wallet_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-right font-mono"
                    placeholder="07xxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">هاتف تواصل إضافي</label>
                  <input
                    type="text"
                    value={paySettings.phone_number}
                    onChange={(e) => setPaySettings({ ...paySettings, phone_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">رسوم التوصيل (د.ع)</label>
                  <input
                    type="number"
                    min={0}
                    data-testid="partner-delivery-fee"
                    value={paySettings.delivery_fee}
                    onChange={(e) => setPaySettings({ ...paySettings, delivery_fee: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-right"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">حساب بنكي / آيبان (اختياري)</label>
                  <input
                    type="text"
                    value={paySettings.bank_account}
                    onChange={(e) => setPaySettings({ ...paySettings, bank_account: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-right font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                data-testid="partner-save-pay-settings"
                disabled={paySettingsSaving}
                onClick={savePaySettings}
                className="mt-4 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
              >
                {paySettingsSaving ? 'جاري الحفظ…' : 'حفظ حسابات استلام الزبائن'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
