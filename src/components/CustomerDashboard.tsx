import React, { useState, useEffect, useCallback } from 'react';
import { User, Calendar, MapPin, Star, Settings, LogOut, Home, Truck, Phone, Save, Bell, Navigation } from 'lucide-react';
import { apiJson, ApiError, apiLogout } from '../lib/api';
import NotificationsPanel from './NotificationsPanel';
import { googleMapsDirectionsUrl } from './MapPicker';
import { iraqWaDigits } from '../lib/phone';

type Row = {
  id: string;
  equipmentId?: string;
  equipment: string;
  partner: string;
  partnerPhone?: string | null;
  dates: string;
  total: number;
  status: string;
  location: string;
  deliveryRequested?: boolean;
  deliveryStatus?: string | null;
  returnRequested?: boolean;
  returnStatus?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  cancelReason?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  reviewed?: boolean;
  paymentStatus?: string | null;
  paymentNotes?: string | null;
  paymentMethod?: string | null;
};

type Fav = {
  id: string;
  title: string;
  category: string;
  price: number;
  partner: string;
  rating: number;
  image?: string;
};

function deliveryLabel(s?: string | null) {
  switch (s) {
    case 'pending_assign':
      return 'بانتظار تعيين مندوب';
    case 'assigned':
      return 'تم تعيين مندوب';
    case 'out_for_delivery':
      return 'المندوب في الطريق';
    case 'delivered':
      return 'تم التسليم';
    case 'failed':
      return 'تعذّر التسليم';
    default:
      return s || '—';
  }
}

function paymentLabel(s?: string | null, method?: string | null) {
  const m = String(method || '').toLowerCase();
  const isCod = m === 'cash' || m === 'cash_on_delivery';
  switch (s) {
    case 'approved':
    case 'paid':
    case 'completed':
      return isCod ? 'تم استلام النقد / مقبول' : 'الدفع مقبول';
    case 'under_review':
    case 'proof_uploaded':
      return 'الدفع قيد المراجعة';
    case 'pending':
      return isCod ? 'دفع عند الاستلام — بانتظار التسليم' : 'الدفع قيد المراجعة';
    case 'rejected':
    case 'failed':
      return 'الدفع مرفوض';
    case 'refunded':
      return 'بانتظار استرداد المبلغ';
    case 'completed':
      return isCod ? 'تم استلام النقد / مقبول' : 'الدفع مكتمل / تم الاسترداد';
    default:
      return s ? `دفع: ${s}` : null;
  }
}

function paymentBadgeClass(s?: string | null) {
  if (!s) return 'bg-slate-100 text-slate-600';
  if (['approved', 'paid', 'completed'].includes(s)) return 'bg-green-50 text-green-700';
  if (['rejected', 'failed'].includes(s)) return 'bg-red-50 text-red-700';
  if (s === 'refunded') return 'bg-violet-50 text-violet-800';
  return 'bg-amber-50 text-amber-800';
}

const PREFS_KEY = (uid?: string) => `ijar_customer_prefs_${uid || 'anon'}`;

export default function CustomerDashboard({
  userId,
  userEmail,
  onBack,
  onLogout,
  onOpenEquipment,
}: {
  userId?: string;
  userEmail?: string;
  onBack: () => void;
  onLogout?: () => void;
  onOpenEquipment?: (equipmentId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState('rentals');
  const [bookings, setBookings] = useState<Row[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [favorites, setFavorites] = useState<Fav[]>([]);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [notifyOn, setNotifyOn] = useState(true);
  const [lang, setLang] = useState('ar');
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<Record<string, { rating: number; comment: string }>>({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [repayBusy, setRepayBusy] = useState<string | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [focusBookingId, setFocusBookingId] = useState<string | null>(null);

  const loadPrefs = useCallback(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY(userId));
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.notifyOn === 'boolean') setNotifyOn(p.notifyOn);
      if (p.lang) setLang(String(p.lang));
    } catch {
      // ignore
    }
  }, [userId]);

  const savePrefs = (next: { notifyOn?: boolean; lang?: string }) => {
    const merged = {
      notifyOn: next.notifyOn ?? notifyOn,
      lang: next.lang ?? lang,
    };
    if (next.notifyOn != null) setNotifyOn(next.notifyOn);
    if (next.lang != null) setLang(next.lang);
    localStorage.setItem(PREFS_KEY(userId), JSON.stringify(merged));
    if (next.notifyOn != null && userId) {
      apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ email_notifications: next.notifyOn }),
      }).catch(() => {});
    }
  };

  const loadFavorites = useCallback(async () => {
    try {
      const rows = await apiJson<any[]>('/api/favorites');
      setFavorites(
        rows.map((e) => ({
          id: String(e.id),
          title: String(e.title || '—'),
          category: String(e.category || ''),
          price: Number(e.price_per_day || 0),
          partner: String(e.owner_name || ''),
          rating: Number(e.average_rating || 0),
          image: Array.isArray(e.images) && e.images[0] ? String(e.images[0]) : undefined,
        }))
      );
    } catch {
      setFavorites([]);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    if (!userId) return;
    setLoadingBookings(true);
    try {
      const raw = await apiJson<any[]>(`/api/bookings/customer/${userId}`);
      setBookings(
        raw.map((b) => ({
          id: String(b.id),
          equipmentId: String(b.equipment_id || ''),
          equipment: String(b.equipment_title || '—'),
          partner: String(b.owner_name || '—'),
          partnerPhone: b.owner_phone ? String(b.owner_phone) : null,
          dates: `${new Date(b.start_date).toLocaleDateString('ar-IQ')} – ${new Date(b.end_date).toLocaleDateString('ar-IQ')}`,
          total: Number(b.total_amount),
          status: String(b.status),
          location: String(b.delivery_address || b.location || b.equipment_location || '—'),
          deliveryRequested: Boolean(b.delivery_requested),
          deliveryStatus: b.delivery_status ? String(b.delivery_status) : null,
          returnRequested: Boolean(b.return_requested),
          returnStatus: b.return_status ? String(b.return_status) : null,
          deliveryLat: b.delivery_lat != null ? Number(b.delivery_lat) : null,
          deliveryLng: b.delivery_lng != null ? Number(b.delivery_lng) : null,
          pickupLat: b.equipment_pickup_lat != null ? Number(b.equipment_pickup_lat) : null,
          pickupLng: b.equipment_pickup_lng != null ? Number(b.equipment_pickup_lng) : null,
          cancelReason: b.cancel_reason ? String(b.cancel_reason) : null,
          courierName: b.courier_name ? String(b.courier_name) : null,
          courierPhone: b.courier_phone ? String(b.courier_phone) : null,
          reviewed: Boolean(b.has_review),
          paymentStatus: b.payment_status ? String(b.payment_status) : null,
          paymentNotes: b.payment_notes ? String(b.payment_notes) : null,
          paymentMethod: b.payment_method ? String(b.payment_method) : null,
        }))
      );
    } catch {
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadPrefs();
    loadBookings();
    loadFavorites();
    try {
      const focus = sessionStorage.getItem('ijar_focus_booking');
      if (focus) {
        setFocusBookingId(focus);
        setActiveTab('rentals');
        sessionStorage.removeItem('ijar_focus_booking');
      }
    } catch {
      // ignore
    }
    (async () => {
      try {
        const prof = await apiJson<any>('/api/auth/me');
        setProfile(prof);
        setProfileForm({
          name: String(prof.name || ''),
          phone: String(prof.phone || ''),
          email: String(prof.email || userEmail || ''),
        });
      } catch {
        // ignore
      }
    })();
  }, [userId, userEmail, loadBookings, loadFavorites, loadPrefs]);

  useEffect(() => {
    if (!userId) {
      setUnreadNotifs(0);
      return;
    }
    let cancelled = false;
    const pull = async () => {
      try {
        const rows = await apiJson<{ is_read?: boolean }[]>(`/api/notifications/user/${userId}`);
        if (!cancelled) setUnreadNotifs(rows.filter((n) => !n.is_read).length);
      } catch {
        if (!cancelled) setUnreadNotifs(0);
      }
    };
    pull();
    const id = window.setInterval(pull, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [userId, showNotifications]);

  const handleLogout = async () => {
    await apiLogout();
    if (onLogout) onLogout();
    else onBack();
  };

  const saveProfile = async () => {
    setSavingProfile(true);
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
      alert('تم حفظ الملف الشخصي');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر الحفظ');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
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

  const removeFavorite = async (equipmentId: string) => {
    try {
      await apiJson(`/api/favorites/${equipmentId}`, { method: 'DELETE' });
      await loadFavorites();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر الحذف');
    }
  };

  const submitReview = async (bookingId: string) => {
    const draft = reviewDraft[bookingId] || { rating: 5, comment: '' };
    try {
      await apiJson('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: bookingId,
          rating: draft.rating,
          comment: draft.comment || undefined,
        }),
      });
      alert('شكراً لتقييمك');
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, reviewed: true } : b)));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر إرسال التقييم');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    if (!confirm('هل تريد إلغاء هذا الحجز؟')) return;
    try {
      await apiJson(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await loadBookings();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر إلغاء الحجز');
    }
  };

  const resubmitPaymentProof = async (booking: Row, file: File) => {
    setRepayBusy(booking.id);
    try {
      const proof_image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
        reader.readAsDataURL(file);
      });
      await apiJson('/api/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: booking.id,
          amount: booking.total,
          payment_method: 'manual',
          proof_image,
          notes: 'تحديث/استبدال إثبات الدفع',
        }),
      });
      alert('تم إرسال إثبات الدفع للمراجعة');
      await loadBookings();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'تعذر إرسال الإثبات');
    } finally {
      setRepayBusy(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'مؤكد';
      case 'pending':
        return 'في الانتظار';
      case 'cancelled':
        return 'ملغي';
      case 'completed':
        return 'مكتمل';
      default:
        return status;
    }
  };

  const navItems = [
    { id: 'rentals', label: 'حجوزاتي', icon: Calendar, testId: 'customer-nav-rentals' },
    { id: 'favorites', label: 'مفضلة', icon: Star, testId: 'customer-nav-favorites' },
    { id: 'profile', label: 'حسابي', icon: User, testId: 'customer-nav-profile' },
    { id: 'settings', label: 'إعدادات', icon: Settings, testId: 'customer-nav-settings' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="customer-dashboard">
      <aside className="w-64 bg-slate-900 text-white hidden lg:flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <User size={20} />
            </div>
            <div>
              <div className="font-bold">{profile?.name || 'العميل'}</div>
              <div className="text-xs text-slate-400">{profile?.email || userEmail || '—'}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
                  activeTab === item.id ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <Icon size={18} /> {item.label === 'مفضلة' ? 'المفضلة' : item.label === 'حسابي' ? 'الملف الشخصي' : item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            type="button"
            data-testid="customer-back-home"
            onClick={onBack}
            className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-800 text-slate-400 w-full text-right"
          >
            <Home size={18} /> العودة للرئيسية
          </button>
          <button
            type="button"
            data-testid="customer-logout"
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-red-900/40 text-red-300 w-full text-right"
          >
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 text-white border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
        data-testid="customer-mobile-nav"
      >
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`${item.testId}-m`}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold ${
                  activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onBack}
            className="flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-bold text-slate-400"
          >
            <Home size={16} /> رئيسية
          </button>
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-8 pb-24 lg:pb-8 min-w-0">
        <header className="flex justify-between items-center mb-6 gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">
            {activeTab === 'rentals' && 'حجوزاتي'}
            {activeTab === 'favorites' && 'المعدات المفضلة'}
            {activeTab === 'profile' && 'الملف الشخصي'}
            {activeTab === 'settings' && 'الإعدادات'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="customer-notifications"
              onClick={() => setShowNotifications(true)}
              className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-100"
              title="الإشعارات"
            >
              <Bell size={18} className="text-slate-600" />
              {unreadNotifs > 0 && (
                <span
                  data-testid="customer-notif-badge"
                  className="absolute -top-1 -right-1 min-w-[1.1rem] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                >
                  {unreadNotifs > 99 ? '99+' : unreadNotifs}
                </span>
              )}
            </button>
            <button
              type="button"
              className="lg:hidden text-xs font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg"
              onClick={handleLogout}
            >
              خروج
            </button>
          </div>
        </header>
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          userId={userId}
          onOpenRelated={(n) => {
            if (n.related_id) {
              setFocusBookingId(String(n.related_id));
              setActiveTab('rentals');
            }
          }}
        />

        {activeTab === 'rentals' && (
          <div className="space-y-4">
            {loadingBookings && <p className="text-sm text-slate-500">جاري تحميل الحجوزات…</p>}
            {!loadingBookings && bookings.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
                <Calendar className="mx-auto text-slate-400 mb-3" size={40} />
                <h3 className="font-bold text-slate-700 mb-1">لا توجد حجوزات حالياً</h3>
                <p className="text-slate-500 text-sm">ابدأ باستكشاف المعدات المتاحة للحجز</p>
              </div>
            )}
            {bookings.map((booking) => (
              <div
                key={booking.id}
                data-testid="customer-booking-row"
                className={`bg-white rounded-2xl border p-4 space-y-3 shadow-sm ${
                  focusBookingId === booking.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <h3 className="font-bold text-slate-800">{booking.equipment}</h3>
                    <p className="text-xs text-slate-500 mt-1">{booking.partner}</p>
                    {booking.partnerPhone &&
                      ['pending', 'confirmed'].includes(booking.status) &&
                      iraqWaDigits(booking.partnerPhone) && (
                        <div className="flex flex-wrap gap-2 mt-2 text-[11px] font-bold">
                          <a
                            href={`tel:+${iraqWaDigits(booking.partnerPhone)}`}
                            data-testid="customer-call-partner"
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700"
                          >
                            اتصال بالشريك
                          </a>
                          <a
                            href={`https://wa.me/${iraqWaDigits(booking.partnerPhone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="customer-whatsapp-partner"
                            className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800"
                          >
                            واتساب الشريك
                          </a>
                        </div>
                      )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold shrink-0 ${getStatusColor(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>{booking.dates}</p>
                  <p className="flex items-center gap-1">
                    <MapPin size={12} /> {booking.location}
                  </p>
                  <p className="font-bold text-slate-800">{booking.total.toLocaleString()} د.ع</p>
                  {paymentLabel(booking.paymentStatus, booking.paymentMethod) && (
                    <p
                      data-testid="customer-payment-status"
                      className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${paymentBadgeClass(booking.paymentStatus)}`}
                    >
                      {paymentLabel(booking.paymentStatus, booking.paymentMethod)}
                    </p>
                  )}
                  {booking.paymentNotes &&
                    ['rejected', 'failed'].includes(String(booking.paymentStatus)) && (
                      <p className="text-red-600 text-[11px]">ملاحظة: {booking.paymentNotes}</p>
                    )}
                  {['rejected', 'failed', 'under_review', 'proof_uploaded'].includes(
                    String(booking.paymentStatus)
                  ) &&
                    booking.status !== 'cancelled' &&
                    booking.paymentMethod !== 'cash' &&
                    booking.paymentMethod !== 'cash_on_delivery' && (
                      <label
                        data-testid="customer-repay-proof"
                        className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 cursor-pointer hover:bg-amber-100"
                      >
                        {repayBusy === booking.id
                          ? 'جاري الإرسال…'
                          : String(booking.paymentStatus) === 'under_review' ||
                              String(booking.paymentStatus) === 'proof_uploaded'
                            ? 'استبدال إثبات الدفع'
                            : 'إعادة رفع إثبات الدفع'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={repayBusy === booking.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) resubmitPaymentProof(booking, f);
                          }}
                        />
                      </label>
                    )}
                </div>
                {booking.status === 'cancelled' && booking.cancelReason && (
                  <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1" data-testid="customer-cancel-reason">
                    سبب الإلغاء: {booking.cancelReason}
                  </p>
                )}
                {!booking.deliveryRequested &&
                  booking.pickupLat != null &&
                  booking.pickupLng != null &&
                  Number.isFinite(booking.pickupLat) &&
                  Number.isFinite(booking.pickupLng) && (
                    <a
                      href={googleMapsDirectionsUrl(booking.pickupLat, booking.pickupLng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="customer-open-pickup-map"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-700 font-bold border border-slate-200 text-xs"
                    >
                      <Navigation size={12} /> موقع الاستلام على الخريطة
                    </a>
                  )}
                {booking.deliveryRequested && (
                  <div className="text-xs space-y-2" data-testid="customer-delivery-status">
                    <span className="inline-flex items-center gap-1 font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      <Truck size={10} /> توصيل: {deliveryLabel(booking.deliveryStatus)}
                    </span>
                    {booking.returnRequested && (
                      <span className="inline-flex items-center gap-1 font-bold px-2 py-1 rounded-full bg-violet-50 text-violet-700">
                        استرجاع: {deliveryLabel(booking.returnStatus)}
                      </span>
                    )}
                    {booking.courierName && (
                      <p className="flex items-center gap-1 text-slate-600">
                        <Phone size={10} />
                        {booking.courierName}
                        {booking.courierPhone ? ` · ${booking.courierPhone}` : ''}
                      </p>
                    )}
                    {booking.deliveryLat != null &&
                      booking.deliveryLng != null &&
                      Number.isFinite(booking.deliveryLat) &&
                      Number.isFinite(booking.deliveryLng) && (
                        <a
                          href={googleMapsDirectionsUrl(booking.deliveryLat, booking.deliveryLng)}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="customer-open-delivery-map"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100"
                        >
                          <Navigation size={12} /> موقع التسليم على الخريطة
                        </a>
                      )}
                  </div>
                )}
                {booking.status === 'pending' && (
                  <button
                    type="button"
                    data-testid="customer-cancel-booking"
                    onClick={() => cancelBooking(booking.id)}
                    className="text-xs font-bold text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50"
                  >
                    إلغاء الحجز
                  </button>
                )}
                {booking.status === 'confirmed' && (
                  <p className="text-[11px] text-slate-500" data-testid="customer-cancel-locked">
                    بعد التأكيد لا يمكن الإلغاء من هنا — تواصل مع الشريك أو الدعم.
                  </p>
                )}
                {booking.status === 'completed' && !booking.reviewed && (
                  <div className="border-t border-slate-100 pt-3 space-y-2" data-testid="customer-review-box">
                    <p className="text-xs font-bold text-slate-700">قيّم تجربتك</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setReviewDraft((prev) => ({
                              ...prev,
                              [booking.id]: { rating: n, comment: prev[booking.id]?.comment || '' },
                            }))
                          }
                          className="p-1"
                        >
                          <Star
                            size={18}
                            className={
                              (reviewDraft[booking.id]?.rating || 5) >= n
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-300'
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm"
                      rows={2}
                      placeholder="تعليق اختياري"
                      value={reviewDraft[booking.id]?.comment || ''}
                      onChange={(e) =>
                        setReviewDraft((prev) => ({
                          ...prev,
                          [booking.id]: {
                            rating: prev[booking.id]?.rating || 5,
                            comment: e.target.value,
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      data-testid="customer-submit-review"
                      onClick={() => submitReview(booking.id)}
                      className="text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-xl"
                    >
                      إرسال التقييم
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-4">
            {favorites.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
                <Star className="mx-auto text-slate-400 mb-3" size={40} />
                <h3 className="font-bold text-slate-700 mb-1">لا توجد معدات مفضلة</h3>
                <p className="text-slate-500 text-sm">اضغط النجمة على بطاقة المعدة في الرئيسية</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favorites.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="customer-favorite-card">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="h-36 bg-slate-200" />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 mb-2">
                        {item.category} · {item.partner}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-blue-600">{item.price.toLocaleString()} د.ع/يوم</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-testid="customer-favorite-book"
                            onClick={() => {
                              if (onOpenEquipment) onOpenEquipment(item.id);
                              else onBack();
                            }}
                            className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg"
                          >
                            احجز
                          </button>
                          <button
                            type="button"
                            data-testid="customer-favorite-remove"
                            onClick={() => removeFavorite(item.id)}
                            className="text-red-500 hover:text-red-600"
                            title="إزالة من المفضلة"
                          >
                            <Star size={20} fill="currentColor" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4" data-testid="customer-profile-panel">
            <h3 className="text-lg font-bold">الملف الشخصي</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">الاسم الكامل</label>
                <input
                  type="text"
                  data-testid="customer-profile-name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={profileForm.email}
                  readOnly
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                <input
                  type="tel"
                  data-testid="customer-profile-phone"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">تاريخ الانضمام</label>
                <input
                  type="text"
                  value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ar-IQ') : '—'}
                  readOnly
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50"
                />
              </div>
            </div>
            <button
              type="button"
              data-testid="customer-profile-save"
              disabled={savingProfile}
              onClick={saveProfile}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
            >
              <Save size={16} /> {savingProfile ? 'جاري الحفظ…' : 'حفظ التعديلات'}
            </button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold mb-6">الإعدادات</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg gap-3">
                <div>
                  <div className="font-bold">تذكير الإشعارات</div>
                  <div className="text-sm text-slate-500">
                    تفضيل محلي على هذا الجهاز فقط — الإشعارات داخل المنصة تبقى متاحة من الجرس
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="customer-settings-notify"
                  onClick={() => savePrefs({ notifyOn: !notifyOn })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold ${
                    notifyOn ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {notifyOn ? 'مفعّلة' : 'معطّلة'}
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg gap-3">
                <div>
                  <div className="font-bold">اللغة</div>
                  <div className="text-sm text-slate-500">العربية هي اللغة المعتمدة حالياً</div>
                </div>
                <select
                  data-testid="customer-settings-lang"
                  value="ar"
                  disabled
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-500"
                >
                  <option value="ar">العربية</option>
                </select>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg space-y-3" data-testid="customer-change-password">
                <div className="font-bold">تغيير كلمة المرور</div>
                <input
                  type="password"
                  data-testid="customer-password-current"
                  placeholder="كلمة المرور الحالية"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <input
                  type="password"
                  data-testid="customer-password-new"
                  placeholder="كلمة المرور الجديدة"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <button
                  type="button"
                  data-testid="customer-password-save"
                  disabled={passwordSaving}
                  onClick={changePassword}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
                >
                  {passwordSaving ? 'جاري الحفظ…' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
