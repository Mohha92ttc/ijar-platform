import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Package, Clock, CheckCircle, XCircle, Settings, Plus, BarChart2, Home, Edit2, Trash2, Save, X, Sparkles, CreditCard, Image as ImageIcon, Eye, Truck, Navigation, Bell } from 'lucide-react';
import ImageUpload from './ImageUpload';
import TransferAccountsPanel from './TransferAccountsPanel';
import NotificationsPanel from './NotificationsPanel';
import { apiJson, ApiError } from '../lib/api';
import { paymentMethodLabel, type CartPaymentMethod } from '../lib/cartStorage';
import { IRAQ_GOVERNORATES, GOVERNORATE_AREAS, formatEquipmentLocation, parseLocationHint } from '../lib/iraqLocations';
import MapPicker, { googleMapsDirectionsUrl, type MapPin } from './MapPicker';
import { iraqWaDigits } from '../lib/phone';

type Eq = {
  id: string;
  title: string;
  category: string;
  status: string;
  price: number;
  description: string;
  image: string;
  images: string[];
  location?: string;
  governorate?: string;
  area?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
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
  deliveryRequested?: boolean;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
  assignedCourierId?: string | null;
  courierName?: string | null;
  deliveryStatus?: string | null;
  returnRequested?: boolean;
  returnStatus?: string | null;
  returnCourierId?: string | null;
  returnCourierName?: string | null;
};

type CourierRow = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  is_active: boolean;
  temp_password?: string;
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
    imageFile: null as File | null,
    extraImageFiles: [] as File[],
    existingImages: [] as string[],
    pickupPin: null as MapPin | null,
  });
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [bookings, setBookings] = useState<Bk[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofPreview, setProofPreview] = useState<{ url: string; bookingId: string; title: string } | null>(null);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [newCourier, setNewCourier] = useState({ name: '', phone: '', email: '', password: '' });
  const [courierCreating, setCourierCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; name: string } | null>(null);
  const [courierReportId, setCourierReportId] = useState('');
  const [courierReportMonth, setCourierReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [courierReport, setCourierReport] = useState<any>(null);
  const [myReviews, setMyReviews] = useState<
    { id: string; rating: number; comment?: string; equipment_title?: string; reviewer_name?: string; created_at: string }[]
  >([]);
  const [earnings, setEarnings] = useState<{ gross: number; commission: number; net: number; count: number } | null>(
    null
  );

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
    subscription_duration_months?: number;
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

  const subscriptionActive = Boolean(
    profile?.subscription_active === true ||
      (profile?.subscription_status === 'active' &&
        profile?.subscription_end_date &&
        new Date(profile.subscription_end_date).getTime() > Date.now())
  );

  const subFreezeDays = (() => {
    if (!profile?.subscription_end_date) return 999;
    const end = new Date(profile.subscription_end_date).getTime();
    if (Number.isNaN(end) || end > Date.now()) return 0;
    return Math.max(1, Math.floor((Date.now() - end) / (24 * 60 * 60 * 1000)));
  })();

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
      const mapped: Eq[] = equip.map((e) => {
        const loc = String(e.location || '');
        const hint = parseLocationHint(loc);
        const imgs = Array.isArray(e.images) ? (e.images as string[]).filter(Boolean) : [];
        return {
          id: String(e.id),
          title: String(e.title),
          category: String(e.category),
          status: String(e.status),
          price: Number(e.price_per_day),
          description: String(e.description || ''),
          image: imgs[0] || '',
          images: imgs,
          location: loc,
          governorate: String(e.governorate || hint.governorate || 'بغداد'),
          area: String(e.area || hint.area || ''),
          pickup_lat: e.pickup_lat != null && Number.isFinite(Number(e.pickup_lat)) ? Number(e.pickup_lat) : null,
          pickup_lng: e.pickup_lng != null && Number.isFinite(Number(e.pickup_lng)) ? Number(e.pickup_lng) : null,
        };
      });
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
          location: String(b.delivery_address || b.location || '—'),
          dates: `${new Date(String(b.start_date)).toLocaleDateString('ar-IQ')} – ${new Date(String(b.end_date)).toLocaleDateString('ar-IQ')}`,
          total: Number(b.total_amount),
          status: String(b.status),
          paymentPreference: pref || String(b.payment_db_method || ''),
          paymentProof: resolveProofUrl(b.payment_proof ? String(b.payment_proof) : null),
          paymentStatus: b.payment_status ? String(b.payment_status) : null,
          isCod,
          deliveryRequested: Boolean(b.delivery_requested),
          deliveryLat: b.delivery_lat != null ? Number(b.delivery_lat) : null,
          deliveryLng: b.delivery_lng != null ? Number(b.delivery_lng) : null,
          deliveryAddress: b.delivery_address ? String(b.delivery_address) : null,
          assignedCourierId: b.assigned_courier_id ? String(b.assigned_courier_id) : null,
          courierName: b.courier_name ? String(b.courier_name) : null,
          deliveryStatus: b.delivery_status ? String(b.delivery_status) : null,
          returnRequested: Boolean(b.return_requested),
          returnStatus: b.return_status ? String(b.return_status) : null,
          returnCourierId: b.return_courier_id ? String(b.return_courier_id) : null,
          returnCourierName: b.return_courier_name ? String(b.return_courier_name) : null,
        };
      });
      setBookings(mappedBookings);

      try {
        const prof = await apiJson<any>('/api/auth/me');
        setProfile(prof);
        setProfileForm({
          name: String(prof.name || ''),
          phone: String(prof.phone || ''),
        });
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
    if (!profile) return;
    if (!subscriptionActive && activeTab !== 'featured' && activeTab !== 'settings') {
      setActiveTab('featured');
    }
  }, [profile, subscriptionActive, activeTab]);

  const guardSub = (actionLabel: string) => {
    if (subscriptionActive) return true;
    alert(
      `الحساب مجمّد: ${actionLabel} تحتاج اشتراكاً مفعّلاً. ادفع من تبويب الاشتراك حتى تُعاد منشوراتك للعمل.`
    );
    setActiveTab('featured');
    return false;
  };

  useEffect(() => {
    (async () => {
      try {
        const cats = await apiJson<any[]>('/api/equipment/categories');
        setCategoryOptions(
          cats.map((c) => String(c.name || c)).filter(Boolean)
        );
      } catch {
        setCategoryOptions([]);
      }
    })();
  }, []);

  const loadCouriers = useCallback(async () => {
    if (!ownerId) return;
    try {
      const list = await apiJson<CourierRow[]>('/api/couriers');
      setCouriers(list);
    } catch {
      setCouriers([]);
    }
  }, [ownerId]);

  useEffect(() => {
    if (activeTab === 'couriers' || activeTab === 'bookings') {
      loadCouriers();
    }
  }, [activeTab, loadCouriers]);

  const createCourier = async () => {
    if (!guardSub('إدارة المندوبين')) return;
    if (!newCourier.name.trim() || !newCourier.phone.trim()) {
      alert('الاسم ورقم الهاتف مطلوبان');
      return;
    }
    setCourierCreating(true);
    try {
      const created = await apiJson<CourierRow & { temp_password?: string; email?: string }>('/api/couriers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCourier.name.trim(),
          phone: newCourier.phone.trim(),
          email: newCourier.email.trim() || undefined,
          password: newCourier.password.trim() || undefined,
        }),
      });
      setCreatedCreds({
        name: created.name,
        email: String(created.email || ''),
        password: String(created.temp_password || newCourier.password || ''),
      });
      setNewCourier({ name: '', phone: '', email: '', password: '' });
      await loadCouriers();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر إنشاء المندوب');
    } finally {
      setCourierCreating(false);
    }
  };

  const toggleCourierActive = async (id: string, is_active: boolean) => {
    try {
      await apiJson(`/api/couriers/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
      });
      await loadCouriers();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر التحديث');
    }
  };

  const resetCourierPassword = async (id: string, name: string) => {
    if (!confirm(`إعادة تعيين كلمة مرور المندوب «${name}»؟`)) return;
    try {
      const r = await apiJson<{ email: string; temp_password: string }>(`/api/couriers/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setCreatedCreds({ name, email: r.email, password: r.temp_password });
      alert('تم توليد كلمة مرور جديدة — احفظها أو انسخها من البطاقة الخضراء أعلاه');
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر إعادة التعيين');
    }
  };

  const assignCourier = async (bookingId: string, courier_id: string, leg: 'outbound' | 'return' = 'outbound') => {
    try {
      if (!courier_id) {
        await apiJson(`/api/couriers/unassign/${bookingId}`, {
          method: 'POST',
          body: JSON.stringify({ leg }),
        });
      } else {
        await apiJson(`/api/couriers/assign/${bookingId}`, {
          method: 'POST',
          body: JSON.stringify({ courier_id, leg }),
        });
      }
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر تحديث التعيين');
    }
  };

  const requestReturn = async (bookingId: string) => {
    if (!guardSub('طلب الاسترجاع')) return;
    if (!confirm('طلب استرجاع المعدة من الزبون؟')) return;
    try {
      await apiJson(`/api/couriers/request-return/${bookingId}`, {
        method: 'POST',
        body: '{}',
      });
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر طلب الاسترجاع');
    }
  };

  const ownerMarkDelivery = async (
    bookingId: string,
    delivery_status: 'delivered' | 'failed',
    leg: 'outbound' | 'return' = 'outbound'
  ) => {
    if (!guardSub('تحديث التوصيل')) return;
    const label =
      delivery_status === 'delivered'
        ? leg === 'return'
          ? 'تسجيل استرجاع المعدة يدوياً؟'
          : 'تسجيل تسليم المعدة يدوياً (بدون مندوب)؟'
        : 'تسجيل تعذّر التسليم؟';
    if (!confirm(label)) return;
    try {
      await apiJson(`/api/couriers/mark-status/${bookingId}`, {
        method: 'POST',
        body: JSON.stringify({ delivery_status, leg }),
      });
      await loadData();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر تحديث الحالة');
    }
  };

  const saveCourierEdit = async (id: string, name: string, phone: string) => {
    const n = prompt('اسم المندوب', name);
    if (n == null) return;
    const p = prompt('هاتف المندوب', phone);
    if (p == null) return;
    try {
      await apiJson(`/api/couriers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: n.trim(), phone: p.trim() }),
      });
      await loadCouriers();
    } catch (e: unknown) {
      alert(e instanceof ApiError ? e.message : 'تعذر التحديث');
    }
  };

  const deliveryStatusLabel = (s?: string | null) => {
    switch (s) {
      case 'pending_assign':
        return 'بانتظار تعيين';
      case 'assigned':
        return 'معيّن';
      case 'out_for_delivery':
        return 'قيد التوصيل';
      case 'delivered':
        return 'تم التسليم';
      case 'failed':
        return 'فشل';
      default:
        return s || '—';
    }
  };

  const loadCourierReport = async () => {
    if (!courierReportId) return;
    try {
      const r = await apiJson(`/api/couriers/${courierReportId}/report?month=${encodeURIComponent(courierReportMonth)}`);
      setCourierReport(r);
    } catch (e: unknown) {
      setCourierReport(null);
      alert(e instanceof ApiError ? e.message : 'تعذر جلب التقرير');
    }
  };

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
        if (activeTab === 'reports' && ownerId) {
          try {
            const revs = await apiJson<any[]>(`/api/reviews/owner/${ownerId}`);
            setMyReviews(
              (revs || []).map((r) => ({
                id: String(r.id),
                rating: Number(r.rating) || 0,
                comment: r.comment ? String(r.comment) : undefined,
                equipment_title: r.equipment_title ? String(r.equipment_title) : undefined,
                reviewer_name: r.reviewer_name ? String(r.reviewer_name) : undefined,
                created_at: String(r.created_at || ''),
              }))
            );
          } catch {
            setMyReviews([]);
          }
          try {
            const earn = await apiJson<{ gross: number; commission: number; net: number; count: number }>(
              '/api/payments/my-earnings'
            );
            setEarnings(earn);
          } catch {
            setEarnings(null);
          }
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

  const updateBookingStatus = async (id: string, newStatus: string, reason?: string) => {
    if (!guardSub('تحديث الحجوزات')) return;
    const booking = bookings.find((b) => b.id === id);
    if (newStatus === 'completed' && booking?.deliveryRequested) {
      const ds = String(booking.deliveryStatus || '');
      if (ds !== 'delivered') {
        alert('أكمل تسليم التوصيل للزبون قبل إكمال الإيجار.');
        return;
      }
    }
    if (newStatus === 'completed' && booking?.returnRequested) {
      const rs = String(booking.returnStatus || '');
      if (rs !== 'delivered') {
        alert('أكمل استرجاع المعدة من الزبون قبل إكمال الإيجار.');
        return;
      }
    }
    if (newStatus === 'confirmed' && booking && !booking.isCod) {
      if (!booking.paymentProof) {
        alert('لا يمكن الموافقة قبل وجود صورة إثبات التحويل من الزبون.');
        return;
      }
      const ok = confirm('هل راجعت صورة إثبات التحويل وتأكدت من وصول المبلغ؟');
      if (!ok) return;
    }
    let cancelReason = reason;
    if (newStatus === 'cancelled' && !cancelReason) {
      const typed = window.prompt('سبب رفض/إلغاء الحجز (يظهر للزبون):', 'المعدة غير متاحة');
      if (typed === null) return;
      cancelReason = typed.trim() || 'رفض الشريك للحجز';
    }
    try {
      await apiJson(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason: cancelReason }),
      });
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر تحديث حالة الحجز');
    }
  };

  const emptyEquipmentForm = () => ({
    title: '',
    category: '',
    price: '',
    description: '',
    governorate: 'بغداد',
    area: '',
    imageFile: null as File | null,
    extraImageFiles: [] as File[],
    existingImages: [] as string[],
    pickupPin: null as MapPin | null,
  });

  const addEquipment = async () => {
    if (!guardSub('إضافة/تعديل المعدات')) return;
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

    const hasAnyImage =
      Boolean(newEquipment.imageFile) ||
      newEquipment.extraImageFiles.length > 0 ||
      newEquipment.existingImages.length > 0;
    if (!editingEquipmentId && !hasAnyImage) {
      alert('أرفق صورة حقيقية للمعدة قبل الحفظ.');
      return;
    }

    const images: string[] = [...newEquipment.existingImages];
    if (newEquipment.imageFile) {
      images.unshift(await fileToDataUrl(newEquipment.imageFile));
    }
    for (const f of newEquipment.extraImageFiles) {
      if (images.length >= 5) break;
      images.push(await fileToDataUrl(f));
    }
    const uniqueImages = Array.from(new Set(images.filter(Boolean))).slice(0, 5);
    if (!uniqueImages.length) {
      alert('الصورة مطلوبة.');
      return;
    }

    const governorate = newEquipment.governorate.trim();
    const area = newEquipment.area.trim() || null;
    const location = formatEquipmentLocation(governorate, area);
    const pickup_lat = newEquipment.pickupPin?.lat ?? null;
    const pickup_lng = newEquipment.pickupPin?.lng ?? null;

    try {
      if (editingEquipmentId) {
        await apiJson(`/api/equipment/${editingEquipmentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: newEquipment.title,
            description: newEquipment.description || '—',
            category: newEquipment.category,
            price_per_day: price,
            location,
            governorate,
            area,
            images: uniqueImages,
            pickup_lat,
            pickup_lng,
            ownerId,
          }),
        });
      } else {
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
            images: uniqueImages,
            pickup_lat,
            pickup_lng,
            ownerId,
          }),
        });
      }
      setNewEquipment(emptyEquipmentForm());
      setShowAddForm(false);
      setEditingEquipmentId(null);
      await loadData();
    } catch {
      alert(editingEquipmentId ? 'تعذر تحديث المعدة' : 'تعذر حفظ المعدة');
    }
  };

  const startEditEquipment = (equipment: Eq) => {
    setEditingEquipmentId(equipment.id);
    setNewEquipment({
      title: equipment.title,
      category: equipment.category,
      price: String(equipment.price),
      description: equipment.description || '',
      governorate: equipment.governorate || 'بغداد',
      area: equipment.area || '',
      imageFile: null,
      extraImageFiles: [],
      existingImages: equipment.images?.length ? equipment.images : equipment.image ? [equipment.image] : [],
      pickupPin:
        equipment.pickup_lat != null && equipment.pickup_lng != null
          ? { lat: equipment.pickup_lat, lng: equipment.pickup_lng }
          : null,
    });
    setShowAddForm(true);
    setActiveTab('equipment');
  };

  const setEquipmentStatus = async (id: string, status: string) => {
    if (!ownerId) return;
    try {
      await apiJson(`/api/equipment/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ownerId, status }),
      });
      await loadData();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر تحديث الحالة');
    }
  };

  const savePartnerProfile = async () => {
    setProfileSaving(true);
    try {
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim(),
        }),
      });
      const prof = await apiJson<any>('/api/auth/me');
      setProfile(prof);
      setProfileForm({
        name: String(prof.name || ''),
        phone: String(prof.phone || ''),
      });
      alert('تم حفظ الملف الشخصي');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر الحفظ');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePartnerPassword = async () => {
    if (passwordForm.next.length < 8) {
      alert('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
        }),
      });
      setPasswordForm({ current: '', next: '' });
      alert('تم تحديث كلمة المرور');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر تحديث كلمة المرور');
    } finally {
      setPasswordSaving(false);
    }
  };

  const deleteEquipment = async (id: string) => {
    if (!guardSub('حذف المعدات')) return;
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
            data-testid="partner-nav-couriers"
            onClick={() => setActiveTab('couriers')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'couriers' ? 'bg-blue-700' : 'hover:bg-blue-800 text-blue-200'
            }`}
          >
            <Truck size={18} /> المندوبين
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

      {/* موبايل: شريط تنقل سفلي */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-blue-900 text-white border-t border-blue-800 pb-[env(safe-area-inset-bottom)]"
        data-testid="partner-mobile-nav"
      >
        <div className="grid grid-cols-6 gap-0.5 px-1 py-1 overflow-x-auto">
          {(
            [
              { id: 'bookings', label: 'طلبات', icon: Clock, testId: 'partner-nav-bookings-m' },
              { id: 'equipment', label: 'معدات', icon: Package, testId: 'partner-nav-equipment-m' },
              { id: 'couriers', label: 'مندوبين', icon: Truck, testId: 'partner-nav-couriers-m' },
              { id: 'reports', label: 'تقارير', icon: BarChart2, testId: 'partner-nav-reports-m' },
              { id: 'featured', label: 'مميز', icon: Sparkles, testId: 'partner-nav-featured-m' },
              { id: 'settings', label: 'إعدادات', icon: Settings, testId: 'partner-nav-settings-m' },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const on = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold ${
                  on ? 'bg-blue-700 text-white' : 'text-blue-200'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-8 pb-24 lg:pb-8">
        <header className="flex flex-col gap-4 mb-8">
          {!subscriptionActive && (
            <div
              data-testid="partner-sub-freeze-banner"
              className={`rounded-2xl border p-4 ${
                subFreezeDays >= 7
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : subFreezeDays >= 3
                    ? 'bg-orange-50 border-orange-300 text-orange-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <p className="font-bold text-base mb-1">
                {profile?.subscription_status === 'pending'
                  ? 'لازم تفعّل الاشتراك عشان تظهر بالسوق'
                  : 'اشتراكك منتهٍ — معداتك مخفية عن الزبائن'}
              </p>
              <p className="text-sm leading-relaxed mb-3">
                المنشورات موجودة بحسابك بس ما تظهر بالسوق. الطلبات والمعدات والمندوبين مجمّدة.
                الدفع وتجديد الاشتراك شغّالين فقط.
                {subFreezeDays >= 3
                  ? ` (${subFreezeDays} يوم على الانتهاء — الواجهة تبدأ تتجمّد أكثر.)`
                  : ''}
              </p>
              <button
                type="button"
                data-testid="partner-sub-renew-cta"
                onClick={() => setActiveTab('featured')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
              >
                تفعيل / تجديد الاشتراك الآن
              </button>
            </div>
          )}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'bookings' && 'الطلبات الواصلة'}
              {activeTab === 'equipment' && 'معداتي'}
              {activeTab === 'couriers' && 'المندوبين'}
              {activeTab === 'reports' && 'التقارير'}
              {activeTab === 'featured' && (subscriptionActive ? 'إعلان مميز مدفوع' : 'تفعيل الاشتراك والدفع')}
              {activeTab === 'settings' && 'الإعدادات'}
            </h2>
            <p className="text-slate-500 text-sm">
              {loading && 'جاري التحميل من الخادم…'}
              {!loading && activeTab === 'bookings' && `لديك ${bookings.filter((b) => b.status === 'pending').length} طلبات جديدة بانتظار المراجعة`}
              {!loading && activeTab === 'equipment' && `لديك ${myEquipment.length} معدة مسجلة`}
              {!loading && activeTab === 'couriers' && `${couriers.length} مندوب مسجّل`}
              {!loading && activeTab === 'reports' && 'إحصائيات أداء حسابك'}
              {!loading && activeTab === 'featured' && (subscriptionActive
                ? 'الظهور في مقدمة القائمة بعد الموافقة على الدفع'
                : 'ادفع الاشتراك لترجع معداتك للسوق وتُفتح اللوحة')}
              {!loading && activeTab === 'settings' && 'إدارة معلومات حسابك'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="partner-notifications"
              onClick={() => setShowNotifications(true)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50"
              title="الإشعارات"
            >
              <Bell size={18} className="text-slate-600" />
            </button>
            {activeTab === 'equipment' && subscriptionActive && (
              <button 
                type="button"
                data-testid="partner-open-add-equipment"
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"
              >
                <Plus size={18} /> إضافة معدة جديدة
              </button>
            )}
          </div>
        </header>
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          userId={ownerId}
          onOpenRelated={(n) => {
            if (n.related_id) {
              try {
                sessionStorage.setItem('ijar_focus_booking', String(n.related_id));
              } catch {
                // ignore
              }
              setActiveTab('bookings');
            }
          }}
        />

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
                        {booking.status === 'confirmed' ? 'مثبت' : booking.status === 'cancelled' ? 'ملغي' : booking.status === 'completed' ? 'مكتمل' : 'بانتظار الموافقة'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        {mapPayLabel(booking.paymentPreference)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 flex flex-wrap gap-x-6 gap-y-1 items-center">
                      <span className="flex items-center gap-1 font-medium text-slate-700 underline underline-offset-4 decoration-blue-200">{booking.customer}</span>
                      <span>الهاتف: {booking.phone || '—'}</span>
                      {iraqWaDigits(booking.phone) && (
                        <>
                          <a
                            href={`tel:+${iraqWaDigits(booking.phone)}`}
                            data-testid="partner-call-customer"
                            className="text-blue-700 font-bold hover:underline"
                          >
                            اتصال
                          </a>
                          <a
                            href={`https://wa.me/${iraqWaDigits(booking.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="partner-whatsapp-customer"
                            className="text-emerald-700 font-bold hover:underline"
                          >
                            واتساب
                          </a>
                        </>
                      )}
                      <span>الموقع: {booking.location}</span>
                      <span>التاريخ: {booking.dates}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="text-left md:text-right">
                      <div className="text-xs text-slate-400">المبلغ الإجمالي</div>
                      <div className="text-lg font-bold text-blue-600">{booking.total.toLocaleString()} د.ع</div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {booking.status === 'pending' && (
                        <>
                          <button 
                            type="button"
                            data-testid="partner-booking-approve"
                            disabled={!booking.isCod && !booking.paymentProof}
                            onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                            className={`p-2 rounded-lg transition-colors ${
                              !booking.isCod && !booking.paymentProof
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={
                              !booking.isCod && !booking.paymentProof
                                ? 'بانتظار إثبات التحويل'
                                : 'موافقة'
                            }
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
                      {booking.status === 'confirmed' && (
                        <button
                          type="button"
                          data-testid="partner-booking-complete"
                          disabled={
                            (Boolean(booking.deliveryRequested) &&
                              String(booking.deliveryStatus || '') !== 'delivered') ||
                            (Boolean(booking.returnRequested) &&
                              String(booking.returnStatus || '') !== 'delivered')
                          }
                          onClick={() => updateBookingStatus(booking.id, 'completed')}
                          className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            booking.deliveryRequested &&
                            String(booking.deliveryStatus || '') !== 'delivered'
                              ? 'بانتظار اكتمال التوصيل'
                              : booking.returnRequested &&
                                  String(booking.returnStatus || '') !== 'delivered'
                                ? 'بانتظار اكتمال الاسترجاع'
                                : 'إكمال الإيجار'
                          }
                        >
                          إكمال الإيجار
                        </button>
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

                  {booking.deliveryRequested && (
                    <div className="border-t border-slate-100 pt-4 space-y-3" data-testid="partner-booking-delivery">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Truck size={14} /> توصيل
                        </span>
                        {booking.deliveryStatus && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                            {deliveryStatusLabel(booking.deliveryStatus)}
                          </span>
                        )}
                        {booking.courierName && (
                          <span className="text-slate-500">المندوب: {booking.courierName}</span>
                        )}
                      </div>
                      {booking.deliveryStatus === 'failed' && (
                        <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2" data-testid="partner-delivery-failed-hint">
                          فشل التوصيل — اختر مندوباً من القائمة لإعادة المحاولة (تُصفّر حالة الفشل).
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <select
                          data-testid="partner-assign-courier"
                          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                          value={booking.assignedCourierId || ''}
                          onChange={(e) => assignCourier(booking.id, e.target.value)}
                        >
                          <option value="">بدون مندوب (إلغاء التعيين)</option>
                          {couriers.filter((c) => c.is_active).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — {c.phone}
                            </option>
                          ))}
                        </select>
                        {booking.deliveryLat != null && booking.deliveryLng != null && (
                          <a
                            href={googleMapsDirectionsUrl(booking.deliveryLat, booking.deliveryLng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="partner-open-delivery-map"
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold border border-blue-100"
                          >
                            <Navigation size={14} /> الخريطة
                          </a>
                        )}
                      </div>
                      {booking.deliveryStatus !== 'delivered' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            data-testid="partner-self-delivered"
                            onClick={() => ownerMarkDelivery(booking.id, 'delivered', 'outbound')}
                            className="text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100"
                          >
                            سلّمت بنفسي
                          </button>
                          {booking.deliveryStatus !== 'failed' && (
                            <button
                              type="button"
                              data-testid="partner-self-failed"
                              onClick={() => ownerMarkDelivery(booking.id, 'failed', 'outbound')}
                              className="text-xs font-bold px-3 py-2 rounded-xl bg-red-50 text-red-800 border border-red-100"
                            >
                              تعذّر التسليم
                            </button>
                          )}
                        </div>
                      )}
                      {couriers.length === 0 && (
                        <p className="text-[11px] text-amber-700">أضف مندوبين من تبويب «المندوبين» أولاً، أو سجّل «سلّمت بنفسي».</p>
                      )}

                      {booking.deliveryStatus === 'delivered' && (
                        <div className="border-t border-dashed border-slate-200 pt-3 space-y-2" data-testid="partner-return-section">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-slate-700">استرجاع المعدة</span>
                            {booking.returnRequested ? (
                              <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold">
                                {deliveryStatusLabel(booking.returnStatus) === '—'
                                  ? 'مطلوب'
                                  : deliveryStatusLabel(booking.returnStatus)}
                              </span>
                            ) : (
                              <span className="text-slate-400">اختياري بعد التسليم</span>
                            )}
                            {booking.returnCourierName && (
                              <span className="text-slate-500">مندوب الاسترجاع: {booking.returnCourierName}</span>
                            )}
                          </div>
                          {!booking.returnRequested ? (
                            <button
                              type="button"
                              data-testid="partner-request-return"
                              onClick={() => requestReturn(booking.id)}
                              className="text-xs font-bold px-3 py-2 rounded-xl bg-violet-50 text-violet-800 border border-violet-100"
                            >
                              طلب استرجاع من الزبون
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <select
                                data-testid="partner-assign-return-courier"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                                value={booking.returnCourierId || ''}
                                onChange={(e) => assignCourier(booking.id, e.target.value, 'return')}
                              >
                                <option value="">بدون مندوب (إلغاء التعيين)</option>
                                {couriers.filter((c) => c.is_active).map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} — {c.phone}
                                  </option>
                                ))}
                              </select>
                              {booking.returnStatus !== 'delivered' && (
                                <button
                                  type="button"
                                  data-testid="partner-self-return-delivered"
                                  onClick={() => ownerMarkDelivery(booking.id, 'delivered', 'return')}
                                  className="text-xs font-bold px-3 py-2 rounded-xl bg-violet-50 text-violet-800 border border-violet-100"
                                >
                                  استرجعت بنفسي
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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

        {/* Couriers Tab */}
        {activeTab === 'couriers' && (
          <div className="space-y-6" data-testid="partner-couriers-tab">
            {createdCreds && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm space-y-2" data-testid="partner-courier-creds">
                <p className="font-bold text-emerald-800">تم إنشاء حساب المندوب — احفظ بيانات الدخول:</p>
                <p>الاسم: {createdCreds.name}</p>
                <p>البريد: <span className="font-mono">{createdCreds.email}</span></p>
                <p>كلمة المرور: <span className="font-mono">{createdCreds.password}</span></p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    data-testid="partner-courier-copy-creds"
                    className="text-xs font-bold bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
                    onClick={() => {
                      const text = `مندوب: ${createdCreds.name}\nالبريد: ${createdCreds.email}\nكلمة المرور: ${createdCreds.password}\nادخل عبر تطبيق إيجار`;
                      navigator.clipboard?.writeText(text).then(
                        () => alert('تم نسخ بيانات الدخول'),
                        () => alert(text)
                      );
                    }}
                  >
                    نسخ للمشاركة
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`حساب مندوب إيجار\nالبريد: ${createdCreds.email}\nكلمة المرور: ${createdCreds.password}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-lg bg-white"
                  >
                    إرسال واتساب
                  </a>
                  <button type="button" className="text-xs font-bold text-emerald-700 underline px-2" onClick={() => setCreatedCreds(null)}>
                    إخفاء
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-blue-600" /> إضافة مندوب
              </h3>
              <p className="text-xs text-slate-500">يُنشأ حساب دخول تلقائياً بصلاحية مندوب فقط — يرى الطلبات التي تحوّلها له.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  data-testid="partner-courier-name"
                  placeholder="اسم المندوب"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  value={newCourier.name}
                  onChange={(e) => setNewCourier({ ...newCourier, name: e.target.value })}
                />
                <input
                  data-testid="partner-courier-phone"
                  placeholder="رقم الهاتف"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  value={newCourier.phone}
                  onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
                />
                <input
                  data-testid="partner-courier-email"
                  placeholder="بريد اختياري (وإلا يُولَّد تلقائياً)"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  value={newCourier.email}
                  onChange={(e) => setNewCourier({ ...newCourier, email: e.target.value })}
                />
                <input
                  data-testid="partner-courier-password"
                  placeholder="كلمة مرور اختيارية (وإلا تُولَّد)"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                  value={newCourier.password}
                  onChange={(e) => setNewCourier({ ...newCourier, password: e.target.value })}
                />
              </div>
              <button
                type="button"
                data-testid="partner-courier-create"
                disabled={courierCreating}
                onClick={createCourier}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60"
              >
                {courierCreating ? 'جاري الإنشاء…' : 'إنشاء مندوب'}
              </button>
            </div>

            <div className="grid gap-3">
              {couriers.map((c) => (
                <div
                  key={c.id}
                  data-testid="partner-courier-card"
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="partner-courier-edit"
                      onClick={() => saveCourierEdit(c.id, c.name, c.phone)}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCourierActive(c.id, !c.is_active)}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                    >
                      {c.is_active ? 'إيقاف' : 'تفعيل'}
                    </button>
                    <button
                      type="button"
                      data-testid="partner-courier-reset-password"
                      onClick={() => resetCourierPassword(c.id, c.name)}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-amber-200 text-amber-800 bg-amber-50"
                    >
                      كلمة مرور جديدة
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourierReportId(c.id)}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-50 text-slate-700 border border-slate-200"
                    >
                      تقرير
                    </button>
                  </div>
                </div>
              ))}
              {couriers.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">لا يوجد مندوبون بعد</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3" data-testid="partner-courier-report-panel">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 size={18} /> تقرير مندوب شهري
              </h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">المندوب</label>
                  <select
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white min-w-[180px]"
                    value={courierReportId}
                    onChange={(e) => setCourierReportId(e.target.value)}
                  >
                    <option value="">اختر…</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">الشهر</label>
                  <input
                    type="month"
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    value={courierReportMonth}
                    onChange={(e) => setCourierReportMonth(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  data-testid="partner-courier-report-load"
                  onClick={loadCourierReport}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold"
                >
                  عرض
                </button>
              </div>
              {courierReport && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">تم التسليم</p>
                    <p className="text-xl font-bold">{courierReport.delivered_count}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">أجور التوصيل</p>
                    <p className="text-lg font-bold">{Number(courierReport.total_delivery_fees || 0).toLocaleString()} د.ع</p>
                  </div>
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
                <h3 className="text-lg font-bold mb-4">{editingEquipmentId ? 'تعديل المعدة' : 'إضافة معدة جديدة'}</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    data-testid="partner-equipment-title"
                    placeholder="اسم المعدة"
                    value={newEquipment.title}
                    onChange={(e) => setNewEquipment({...newEquipment, title: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <select
                    data-testid="partner-equipment-category"
                    value={newEquipment.category}
                    onChange={(e) => setNewEquipment({ ...newEquipment, category: e.target.value })}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    <option value="">اختر التصنيف</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {newEquipment.category && !categoryOptions.includes(newEquipment.category) && (
                      <option value={newEquipment.category}>{newEquipment.category}</option>
                    )}
                  </select>
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
                  <label className="text-sm font-medium text-slate-700">صور المعدة (حتى 5)</label>
                  <ImageUpload
                    key={editingEquipmentId || 'new'}
                    currentImage={newEquipment.existingImages[0] || undefined}
                    onImageSelect={(file) =>
                      setNewEquipment({
                        ...newEquipment,
                        imageFile: file,
                        existingImages: file
                          ? newEquipment.existingImages
                          : newEquipment.existingImages.slice(1),
                      })
                    }
                    className="h-48"
                  />
                  {newEquipment.existingImages.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {newEquipment.existingImages.slice(1).map((src, i) => (
                        <div key={`${src}-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-1"
                            onClick={() =>
                              setNewEquipment({
                                ...newEquipment,
                                existingImages: newEquipment.existingImages.filter((_, idx) => idx !== i + 1),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    data-testid="partner-equipment-extra-images"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).slice(0, 4);
                      setNewEquipment({ ...newEquipment, extraImageFiles: files });
                    }}
                    className="block w-full text-xs text-slate-500"
                  />
                  <p className="text-[11px] text-slate-400">يمكنك إضافة صور إضافية للمعدة</p>
                </div>
                <div className="space-y-2 mb-4" data-testid="partner-equipment-pickup-map">
                  <label className="text-sm font-medium text-slate-700">موقع الاستلام (للزبون عند الاستلام الذاتي)</label>
                  <MapPicker
                    value={newEquipment.pickupPin}
                    onChange={(pin) => setNewEquipment({ ...newEquipment, pickupPin: pin })}
                    height={180}
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
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingEquipmentId(null);
                      setNewEquipment(emptyEquipmentForm());
                    }}
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
                    <img
                      src={
                        equipment.image ||
                        'data:image/svg+xml,' +
                          encodeURIComponent(
                            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#e2e8f0" width="400" height="300"/><text x="200" y="155" text-anchor="middle" fill="#64748b" font-size="16">بدون صورة</text></svg>`
                          )
                      }
                      alt={equipment.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700">
                      {equipment.category}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <select
                        data-testid="partner-equipment-status"
                        value={equipment.status === 'rented' ? 'available' : equipment.status}
                        onChange={(e) => setEquipmentStatus(equipment.id, e.target.value)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border-0 ${
                          equipment.status === 'available'
                            ? 'bg-green-100 text-green-700'
                            : equipment.status === 'maintenance'
                              ? 'bg-amber-100 text-amber-700'
                              : equipment.status === 'hidden'
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-red-100 text-red-700'
                        }`}
                        disabled={equipment.status === 'rented'}
                        title={equipment.status === 'rented' ? 'مؤجرة حالياً' : 'تغيير الحالة'}
                      >
                        {equipment.status === 'rented' ? (
                          <option value="available">مؤجرة</option>
                        ) : (
                          <>
                            <option value="available">متاحة</option>
                            <option value="maintenance">صيانة</option>
                            <option value="hidden">مخفية</option>
                          </>
                        )}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          data-testid="partner-equipment-edit"
                          onClick={() => startEditEquipment(equipment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
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
                <div className="text-sm text-slate-500 mb-1">إيرادات المؤكدة + المكتملة</div>
                <div className="text-2xl font-bold text-blue-600">
                  {bookings
                    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
                    .reduce((sum, b) => sum + b.total, 0)
                    .toLocaleString()}{' '}
                  د.ع
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">الطلبات المكتملة</div>
                <div className="text-2xl font-bold text-slate-800">
                  {bookings.filter((b) => b.status === 'completed').length}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-500 mb-1">الطلبات المعلقة</div>
                <div className="text-2xl font-bold text-amber-600">
                  {bookings.filter((b) => b.status === 'pending').length}
                </div>
              </div>
            </div>

            {earnings && (
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                data-testid="partner-earnings-breakdown"
              >
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500">إجمالي مدفوعات الحجوزات</p>
                  <p className="text-xl font-bold text-slate-800">{earnings.gross.toLocaleString()} د.ع</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500">عمولة المنصة (محاسبة)</p>
                  <p className="text-xl font-bold text-amber-700">{earnings.commission.toLocaleString()} د.ع</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500">صافي الشريك (محاسبة)</p>
                  <p className="text-xl font-bold text-emerald-700">{earnings.net.toLocaleString()} د.ع</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    الزبون يدفع لك مباشرة — الأرقام للمحاسبة حسب نسبة العمولة ({earnings.count} دفعة).
                  </p>
                </div>
              </div>
            )}

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

            <div className="bg-white rounded-2xl border border-slate-200 p-6" data-testid="partner-reviews-panel">
              <h3 className="text-lg font-bold mb-4">تقييمات الزبائن</h3>
              {myReviews.length === 0 ? (
                <p className="text-sm text-slate-500">لا تقييمات بعد — تظهر هنا بعد اكتمال الإيجار وتقييم الزبون.</p>
              ) : (
                <div className="space-y-3">
                  {myReviews.map((r) => (
                    <div key={r.id} className="border border-slate-100 rounded-xl p-3 text-sm" data-testid="partner-review-row">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-bold text-slate-800">{r.equipment_title || 'معدة'}</span>
                        <span className="text-amber-600 font-bold">{'★'.repeat(Math.min(5, r.rating))} ({r.rating})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {r.reviewer_name || 'زبون'}
                        {r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString('ar-IQ')}` : ''}
                      </p>
                      {r.comment && <p className="text-slate-700 mt-2">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Featured promotion Tab */}
        {activeTab === 'featured' && (
          <div className="space-y-8 max-w-3xl">
            {!subscriptionActive && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900" data-testid="partner-sub-required-note">
                الخطوة الإلزامية: حوّل مبلغ الاشتراك وارفع الإثبات. بعد موافقة الإدارة ترجع كل منشوراتك للسوق وتُفتح اللوحة.
              </div>
            )}
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

            <div className={`bg-white rounded-2xl p-6 border border-amber-200 shadow-sm ${!subscriptionActive ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-2">طلب إعلان مميز</h3>
              {!subscriptionActive && (
                <p className="text-xs text-amber-800 mb-2">يتاح بعد تفعيل الاشتراك.</p>
              )}
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

            <div className={`bg-white rounded-2xl p-6 border shadow-sm ${subscriptionActive ? 'border-slate-200' : 'border-blue-400 ring-2 ring-blue-100'}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                {subscriptionActive ? 'تجديد اشتراك المنصة' : 'تفعيل الاشتراك (إلزامي)'}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                نفس حسابات التحويل أعلاه. المبلغ:{' '}
                <span className="font-bold text-blue-600">
                  {(transferInfo?.subscription_renewal_price ?? 100000).toLocaleString()} د.ع
                </span>
                {' '}لمدة {transferInfo?.subscription_duration_months ?? 1} شهر بعد موافقة الإدارة.
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
                {paySubmitting ? 'جاري الإرسال…' : subscriptionActive ? 'إرسال طلب تجديد الاشتراك' : 'رفع إثبات وتفعيل الاشتراك'}
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
                <input
                  type="text"
                  data-testid="partner-profile-name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">البريد الإلكتروني</label>
                <input type="email" value={profile?.email || '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-right" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                <input
                  type="tel"
                  data-testid="partner-profile-phone"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right"
                />
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
              <div className="md:col-span-2">
                <button
                  type="button"
                  data-testid="partner-profile-save"
                  disabled={profileSaving}
                  onClick={savePartnerProfile}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                >
                  <Save size={16} /> {profileSaving ? 'جاري الحفظ…' : 'حفظ الملف الشخصي'}
                </button>
              </div>
              <div className="md:col-span-2 border-t border-slate-100 pt-4 space-y-3" data-testid="partner-change-password">
                <h4 className="font-bold text-slate-800">تغيير كلمة المرور</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    type="password"
                    data-testid="partner-password-current"
                    placeholder="كلمة المرور الحالية"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right"
                  />
                  <input
                    type="password"
                    data-testid="partner-password-new"
                    placeholder="كلمة المرور الجديدة"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right"
                  />
                </div>
                <button
                  type="button"
                  data-testid="partner-password-save"
                  disabled={passwordSaving}
                  onClick={changePartnerPassword}
                  className="inline-flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                >
                  {passwordSaving ? 'جاري الحفظ…' : 'تحديث كلمة المرور'}
                </button>
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
