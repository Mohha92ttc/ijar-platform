import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Package, Calendar, Clock, BarChart3, TrendingUp, Settings, LogOut, Search, Filter, Plus, 
  MapPin, Phone, Mail, Globe, Save, X, Edit2, CheckCircle, CreditCard, Bell, Trash2, ArrowRight, Eye, Download, Info,
  FileText, Home, Sparkles, Truck, Headphones
} from 'lucide-react';
import { apiJson, ApiError, clearSession, getStoredUser } from '../lib/api';
import AdminSettings from './AdminSettings';
import PaymentsTab from './PaymentsTab';
import PaymentApproval from './PaymentApproval';
import PartnerStatement from './PartnerStatement';
import ImageUpload from './ImageUpload';
import NotificationsPanel from './NotificationsPanel';
import AdminBookingsPanel from './AdminBookingsPanel';
import AdminEquipmentPanel from './AdminEquipmentPanel';
import AdminSupportPanel from './AdminSupportPanel';

export default function AdminDashboard({ onBack }: { onBack?: () => void }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEquipment: 0,
    totalBookings: 0,
    monthlyRevenue: 0,
    totalCommission: 0
  });
  const [mostRented, setMostRented] = useState<
    { equipmentId: string; title: string; bookingCount: number; totalRevenue: number }[]
  >([]);

  const [newPartner, setNewPartner] = useState({ 
    name: '', 
    email: '', 
    phone: '',
    password: '',
    confirmPassword: '',
    subscriptionMonths: 1
  });
  const [showPartnerForm, setShowPartnerForm] = useState(false);

  const [platformInfo, setPlatformInfo] = useState<any>({
    name: 'إيجار',
    description: '',
    phones: [],
    emails: [],
    addresses: [],
    mission: '',
    vision: '',
    bank_name: '',
    bank_account_iban: '',
    card_number_display: '',
    transfer_instructions: '',
    featured_ad_price: 50000,
    featured_duration_days: 30,
    subscription_renewal_price: 100000,
  });

  const [categories, setCategories] = useState<any[]>([]);

  const [newCategory, setNewCategory] = useState({ name: '', imageFile: null as File | null });
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const [activeTab, setActiveTab] = useState('partners');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [tempInfo, setTempInfo] = useState({...platformInfo});
  const [lastResetToken, setLastResetToken] = useState<{
    email: string;
    token: string;
    at: string;
  } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const adminUserId = getStoredUser()?.id;

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersData = await apiJson<any[]>('/api/admin/users');
      const mappedPartners = usersData
        .filter((u) => u.role === 'owner')
        .map((u) => ({
          id: String(u.id),
          name: String(u.name),
          email: String(u.email),
          phone: String(u.phone || '—'),
          status: u.is_approved ? 'approved' : 'pending',
          subStatus: String(u.subscription_status || 'none'),
          subEnd: u.subscription_end_date ? new Date(u.subscription_end_date).toISOString().split('T')[0] : null,
          joined: new Date(u.joined).toISOString().split('T')[0],
        }));
      setPartners(mappedPartners);
      const mappedCustomers = usersData
        .filter((u) => u.role === 'customer')
        .map((u) => ({
          id: String(u.id),
          name: String(u.name),
          email: String(u.email),
          phone: String(u.phone || '—'),
          subscription_status: String(u.subscription_status || 'none'),
          joined: new Date(u.joined).toISOString().split('T')[0],
        }));
      setCustomers(mappedCustomers);
      const mappedCouriers = usersData
        .filter((u) => u.role === 'courier')
        .map((u) => ({
          id: String(u.id),
          name: String(u.name),
          email: String(u.email),
          phone: String(u.phone || '—'),
          joined: new Date(u.joined).toISOString().split('T')[0],
        }));
      setCouriers(mappedCouriers);
      
      const statsData = await apiJson<any>('/api/admin/stats');
      if (statsData.stats) {
        setStats(statsData.stats);
      }
      if (Array.isArray(statsData.mostRented)) {
        setMostRented(
          statsData.mostRented.map((r: any) => ({
            equipmentId: String(r.equipmentId),
            title: String(r.title),
            bookingCount: Number(r.bookingCount || 0),
            totalRevenue: Number(r.totalRevenue || 0),
          }))
        );
      }

      const settingsData = await apiJson<any>('/api/admin/settings');
      if (settingsData) {
        const normalized = {
          ...settingsData,
          phones: Array.isArray(settingsData.phones) ? settingsData.phones : [String(settingsData.phones || '')],
          emails: Array.isArray(settingsData.emails) ? settingsData.emails : [String(settingsData.emails || '')],
          addresses: Array.isArray(settingsData.addresses)
            ? settingsData.addresses
            : [String(settingsData.addresses || '')],
        };
        setPlatformInfo(normalized);
        setTempInfo(normalized);
      }

      const catsData = await apiJson<any[]>('/api/equipment/categories');
      setCategories(catsData);
      const resetReqs = await apiJson<any[]>('/api/admin/password-reset-requests');
      setPasswordResetRequests(resetReqs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await apiJson(`/api/admin/users/${id}/approve`, { method: 'PATCH' });
      fetchData();
    } catch (err) {
      alert('فشل تحديث حالة الشريك');
    }
  };

  const handleBan = async (id: string) => {
    if (!confirm('هل أنت متأكد من حظر هذا المستخدم؟')) return;
    try {
      await apiJson(`/api/admin/users/${id}/ban`, { method: 'PATCH' });
      fetchData();
    } catch (err) {
      alert('فشل حظر المستخدم');
    }
  };

  const handleUnban = async (id: string) => {
    if (!confirm('إلغاء حظر هذا المستخدم؟')) return;
    try {
      await apiJson(`/api/admin/users/${id}/unban`, { method: 'PATCH' });
      fetchData();
    } catch (err) {
      alert('فشل إلغاء الحظر');
    }
  };

  const handleRenewSubscription = async (id: string) => {
    const months = prompt('عدد أشهر التجديد:', '1');
    if (months && !isNaN(parseInt(months))) {
      try {
        await apiJson(`/api/admin/users/${id}/renew`, {
          method: 'POST',
          body: JSON.stringify({ months: parseInt(months) })
        });
        fetchData();
        alert('تم تجديد الاشتراك بنجاح');
      } catch (err) {
        alert('فشل تجديد الاشتراك');
      }
    }
  };

  const addPartner = async () => {
    if (newPartner.name && newPartner.email && newPartner.password) {
      if (newPartner.password !== newPartner.confirmPassword) {
        alert('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
        return;
      }
      
      try {
        try {
          await apiJson('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({
              name: newPartner.name,
              email: newPartner.email,
              phone: newPartner.phone,
              password: newPartner.password,
              role: 'owner',
              subscriptionMonths: newPartner.subscriptionMonths || 1,
            })
          });
        } catch (firstErr) {
          // Fallback while Render catches up / old deploy
          if (firstErr instanceof ApiError && firstErr.status === 404) {
            await apiJson('/api/auth/register', {
              method: 'POST',
              body: JSON.stringify({
                name: newPartner.name,
                email: newPartner.email,
                phone: newPartner.phone,
                password: newPartner.password,
                role: 'owner',
                auto_approve: true,
              })
            });
          } else {
            throw firstErr;
          }
        }
        setNewPartner({ name: '', email: '', phone: '', password: '', confirmPassword: '', subscriptionMonths: 1 });
        setShowPartnerForm(false);
        await fetchData();
        alert('تم إضافة الشريك بنجاح!');
      } catch (err) {
        const msg = err instanceof ApiError || err instanceof Error ? err.message : 'فشل إضافة الشريك';
        if (/انتهت الجلسة|Invalid token|Unauthorized/i.test(String(msg))) {
          clearSession();
          alert('انتهت الجلسة. سجّل الدخول من جديد.');
          window.location.href = '/';
          return;
        }
        alert(msg);
      }
    }
  };

  const deletePartner = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الشريك؟')) return;
    try {
      await apiJson(`/api/admin/users/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert('فشل حذف الشريك');
    }
  };

  const addCategory = async () => {
    if (newCategory.name) {
      let imageUrl = 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400';
      
      const submitCategory = async (img: string) => {
        try {
          await apiJson('/api/equipment/categories', {
            method: 'POST',
            body: JSON.stringify({ name: newCategory.name, image: img })
          });
          setNewCategory({ name: '', imageFile: null });
          setShowCategoryForm(false);
          fetchData();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'فشل إضافة التصنيف';
          alert(msg);
        }
      };

      if (newCategory.imageFile) {
        const reader = new FileReader();
        reader.onloadend = () => submitCategory(reader.result as string);
        reader.readAsDataURL(newCategory.imageFile);
      } else {
        submitCategory(imageUrl);
      }
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;
    try {
      await apiJson(`/api/equipment/categories/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert('فشل حذف التصنيف');
    }
  };

  const reviewPasswordReset = async (id: string, approve: boolean, emailHint?: string) => {
    let notes = '';
    if (!approve) {
      notes = prompt('سبب الرفض') || '';
      if (!notes.trim()) return;
    }
    try {
      const result = await apiJson<{ message: string; completionToken?: string }>(
        `/api/admin/password-reset-requests/${id}/review`,
        {
          method: 'POST',
          body: JSON.stringify({ approve, notes: notes.trim() || undefined }),
        }
      );
      if (approve && result.completionToken) {
        setLastResetToken({
          email: emailHint || '—',
          token: result.completionToken,
          at: new Date().toLocaleString('ar-IQ'),
        });
        setTokenCopied(false);
        setActiveTab('password-resets');
      }
      await fetchData();
    } catch (err) {
      alert('فشل تحديث طلب تغيير كلمة المرور');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white hidden lg:flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-blue-400">لوحة تحكم الإدارة</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            type="button"
            data-testid="admin-nav-partners"
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'partners' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Users size={18} /> إدارة الشركاء
          </button>
          <button
            type="button"
            data-testid="admin-nav-customers"
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'customers' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Users size={18} /> إدارة الزبائن
          </button>
          <button
            type="button"
            data-testid="admin-nav-couriers"
            onClick={() => setActiveTab('couriers')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'couriers' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Truck size={18} /> المندوبين
          </button>
          <button
            type="button"
            data-testid="admin-nav-bookings"
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'bookings' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Calendar size={18} /> الحجوزات
          </button>
          <button
            type="button"
            data-testid="admin-nav-equipment"
            onClick={() => setActiveTab('equipment')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'equipment' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Package size={18} /> المعدات
          </button>
          <button 
            type="button"
            data-testid="admin-nav-payment-approval"
            onClick={() => setActiveTab('payment-approval')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'payment-approval' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <CheckCircle size={18} /> موافقات الدفع
          </button>
          <button 
            type="button"
            data-testid="admin-nav-featured-approval"
            onClick={() => setActiveTab('featured-approval')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'featured-approval' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Sparkles size={18} /> الإعلان المميز
          </button>
          <button 
            type="button"
            data-testid="admin-nav-subscription-approval"
            onClick={() => setActiveTab('subscription-approval')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'subscription-approval' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <CreditCard size={18} /> اشتراكات الشركاء
          </button>
          <button
            type="button"
            data-testid="admin-nav-password-resets"
            onClick={() => setActiveTab('password-resets')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'password-resets' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Bell size={18} /> طلبات تغيير كلمة المرور
          </button>
          <button 
            type="button"
            data-testid="admin-nav-partner-statement"
            onClick={() => setActiveTab('partner-statement')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'partner-statement' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <FileText size={18} /> كشوف الحسابات
          </button>
          <button 
            type="button"
            data-testid="admin-nav-categories"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'categories' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Settings size={18} /> التصنيفات
          </button>
          <button 
            type="button"
            data-testid="admin-nav-support"
            onClick={() => setActiveTab('support')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'support' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Headphones size={18} /> رسائل الدعم
          </button>
          <button 
            type="button"
            data-testid="admin-nav-content"
            onClick={() => setActiveTab('content')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'content' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Settings size={18} /> إدارة المحتوى
          </button>
          <button 
            type="button"
            data-testid="admin-nav-payments"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'payments' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <CreditCard size={18} /> المدفوعات
          </button>
          <button 
            type="button"
            data-testid="admin-nav-settings"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'settings' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Settings size={18} /> إعدادات النظام
          </button>
          <button 
            type="button"
            data-testid="admin-nav-stats"
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'stats' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <BarChart3 size={18} /> الإحصائيات
          </button>
          {onBack && (
            <button
              type="button"
              data-testid="admin-back-home"
              onClick={onBack}
              className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right border-t border-slate-800 mt-4 pt-4 hover:bg-slate-800 text-slate-300"
            >
              <Home size={18} /> العودة للرئيسية
            </button>
          )}
        </nav>
      </aside>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 text-white border-t border-slate-800 pb-[env(safe-area-inset-bottom)] overflow-x-auto"
        data-testid="admin-mobile-nav"
      >
        <div className="flex gap-1 px-2 py-1 min-w-max">
          {(
            [
              { id: 'partners', label: 'شركاء', testId: 'admin-nav-partners-m' },
              { id: 'customers', label: 'زبائن', testId: 'admin-nav-customers-m' },
              { id: 'couriers', label: 'مندوبين', testId: 'admin-nav-couriers-m' },
              { id: 'bookings', label: 'حجوزات', testId: 'admin-nav-bookings-m' },
              { id: 'equipment', label: 'معدات', testId: 'admin-nav-equipment-m' },
              { id: 'payment-approval', label: 'دفعات', testId: 'admin-nav-payment-approval-m' },
              { id: 'subscription-approval', label: 'اشتراك', testId: 'admin-nav-subscription-approval-m' },
              { id: 'categories', label: 'تصنيفات', testId: 'admin-nav-categories-m' },
              { id: 'support', label: 'دعم', testId: 'admin-nav-support-m' },
              { id: 'settings', label: 'إعدادات', testId: 'admin-nav-settings-m' },
              { id: 'stats', label: 'إحصاء', testId: 'admin-nav-stats-m' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={item.testId}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap ${
                activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-8 pb-24 lg:pb-8 min-w-0">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">
            {activeTab === 'partners' && 'إدارة الشركاء والمشتركين'}
            {activeTab === 'customers' && 'إدارة الزبائن'}
            {activeTab === 'couriers' && 'حسابات المندوبين'}
            {activeTab === 'bookings' && 'إدارة الحجوزات'}
            {activeTab === 'equipment' && 'إشراف المعدات'}
            {activeTab === 'payment-approval' && 'موافقات دفع الحجوزات'}
            {activeTab === 'featured-approval' && 'موافقات الإعلان المميز'}
            {activeTab === 'subscription-approval' && 'موافقات اشتراكات الشركاء'}
            {activeTab === 'password-resets' && 'طلبات تغيير كلمة المرور'}
            {activeTab === 'partner-statement' && 'كشوف حسابات الشركاء'}
            {activeTab === 'categories' && 'إدارة التصنيفات'}
            {activeTab === 'content' && 'إدارة محتوى المنصة'}
            {activeTab === 'support' && 'رسائل الدعم من صفحة المساعدة'}
            {activeTab === 'payments' && 'إدارة المدفوعات'}
            {activeTab === 'settings' && 'إعدادات النظام'}
            {activeTab === 'stats' && 'الإحصائيات والتقارير'}
          </h2>
          <div className="flex gap-4">
            <button
              type="button"
              data-testid="admin-notifications"
              onClick={() => setShowNotifications(true)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 self-start"
              title="الإشعارات"
            >
              <Bell size={18} className="text-slate-600" />
            </button>
            {activeTab === 'partners' && (
              <>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    data-testid="admin-partner-search"
                    placeholder="بحث عن شريك..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg py-2 pr-10 pl-4 text-sm outline-none w-64"
                  />
                </div>
                <button 
                  type="button"
                  data-testid="admin-add-partner-btn"
                  onClick={() => setShowPartnerForm(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  <Users size={16} />
                  إضافة شريك
                </button>
              </>
            )}
            {activeTab === 'categories' && (
              <button 
                type="button"
                data-testid="admin-category-toggle"
                onClick={() => setShowCategoryForm(!showCategoryForm)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                <Edit2 size={16} />
                {showCategoryForm ? 'إلغاء' : 'إضافة تصنيف'}
              </button>
            )}
            {activeTab === 'content' && (
              <button 
                onClick={() => {
                  if (!editingInfo) {
                    setTempInfo({
                      ...platformInfo,
                      phones: platformInfo.phones?.length ? [...platformInfo.phones] : [''],
                      emails: platformInfo.emails?.length ? [...platformInfo.emails] : [''],
                      addresses: platformInfo.addresses?.length ? [...platformInfo.addresses] : [''],
                    });
                  }
                  setEditingInfo(!editingInfo);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                {editingInfo ? <X size={16} /> : <Edit2 size={16} />}
                {editingInfo ? 'إلغاء' : 'تعديل'}
              </button>
            )}
          </div>
        </header>
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          userId={adminUserId}
        />

        {/* Categories Tab Content */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            {showCategoryForm && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
              >
                <h3 className="text-lg font-bold mb-4">إضافة تصنيف جديد</h3>
                <div className="space-y-4 mb-4">
                  <input
                    type="text"
                    placeholder="اسم التصنيف"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">صورة التصنيف</label>
                    <ImageUpload
                      onImageSelect={(file) => setNewCategory({...newCategory, imageFile: file})}
                      className="h-48"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={addCategory}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700"
                  >
                    <Save size={16} /> حفظ
                  </button>
                  <button 
                    type="button"
                    data-testid="admin-category-form-cancel"
                    onClick={() => setShowCategoryForm(false)}
                    className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700"
                  >
                    <X size={16} /> إلغاء
                  </button>
                </div>
              </motion.div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <motion.div 
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
                >
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                      <h4 className="text-white font-bold text-lg">{category.name}</h4>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {Number(category.equipment_count ?? 0).toLocaleString('ar-IQ')} معدة
                      </span>
                      <button 
                        onClick={() => deleteCategory(category.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Partner Statement Tab Content */}
        {activeTab === 'partner-statement' && (
          <PartnerStatement />
        )}

        {/* Payment Approval Tab Content */}
        {activeTab === 'payment-approval' && (
          <PaymentApproval filterType="booking" />
        )}

        {activeTab === 'featured-approval' && (
          <PaymentApproval filterType="featured_promotion" />
        )}

        {activeTab === 'subscription-approval' && (
          <PaymentApproval filterType={['subscription_renewal', 'subscription']} />
        )}

        {activeTab === 'password-resets' && (
          <div className="space-y-4">
            {lastResetToken && (
              <div
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3"
                data-testid="admin-reset-token-panel"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-emerald-900">رمز تأكيد إعادة التعيين</h3>
                    <p className="text-xs text-emerald-800 mt-1">
                      سلّم هذا الرمز للمستخدم ({lastResetToken.email}) — صالح 30 دقيقة. يظهر هنا عندما SMTP غير مفعّل.
                    </p>
                    <p className="text-[10px] text-emerald-700 mt-1">{lastResetToken.at}</p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-emerald-800 underline"
                    onClick={() => setLastResetToken(null)}
                  >
                    إخفاء
                  </button>
                </div>
                <code
                  data-testid="admin-reset-token-value"
                  className="block w-full break-all text-xs font-mono bg-white border border-emerald-100 rounded-xl p-3 text-slate-800"
                >
                  {lastResetToken.token}
                </code>
                <button
                  type="button"
                  data-testid="admin-reset-token-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastResetToken.token);
                      setTokenCopied(true);
                    } catch {
                      prompt('انسخ الرمز يدوياً:', lastResetToken.token);
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
                >
                  {tokenCopied ? 'تم النسخ ✓' : 'نسخ الرمز'}
                </button>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-sm font-bold text-slate-600">المستخدم</th>
                  <th className="p-4 text-sm font-bold text-slate-600">البريد</th>
                  <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                  <th className="p-4 text-sm font-bold text-slate-600">التاريخ</th>
                  <th className="p-4 text-sm font-bold text-slate-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {passwordResetRequests.map((r) => (
                  <tr key={String(r.id)} className="border-b border-slate-100">
                    <td className="p-4 font-bold text-slate-800">{r.user_name || '—'}</td>
                    <td className="p-4 text-sm text-slate-600">{r.user_email || r.requested_email}</td>
                    <td className="p-4 text-sm">{r.status}</td>
                    <td className="p-4 text-xs text-slate-500">{new Date(r.created_at).toLocaleString('ar-IQ')}</td>
                    <td className="p-4">
                      {r.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            data-testid="admin-reset-approve"
                            onClick={() =>
                              reviewPasswordReset(
                                String(r.id),
                                true,
                                String(r.user_email || r.requested_email || '')
                              )
                            }
                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-bold"
                          >
                            موافقة
                          </button>
                          <button data-testid="admin-reset-reject" onClick={() => reviewPasswordReset(String(r.id), false)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold">رفض</button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">تمت المعالجة</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Partners Tab Content */}
        {activeTab === 'partners' && (
          <>
            {showPartnerForm && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6"
              >
                <h3 className="text-lg font-bold mb-4">إضافة شريك جديد</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="اسم الشريك"
                    value={newPartner.name}
                    onChange={(e) => setNewPartner({...newPartner, name: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="email"
                    placeholder="البريد الإلكتروني"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({...newPartner, email: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="رقم الهاتف"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <select
                    value={newPartner.subscriptionMonths}
                    onChange={(e) => setNewPartner({...newPartner, subscriptionMonths: parseInt(e.target.value)})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="0">بدون اشتراك (في انتظار)</option>
                    <option value="1">اشتراك 1 شهر</option>
                    <option value="3">اشتراك 3 أشهر</option>
                    <option value="6">اشتراك 6 أشهر</option>
                    <option value="12">اشتراك 12 شهر</option>
                  </select>
                  <input
                    type="password"
                    placeholder="كلمة المرور"
                    value={newPartner.password}
                    onChange={(e) => setNewPartner({...newPartner, password: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                  <input
                    type="password"
                    placeholder="تأكيد كلمة المرور"
                    value={newPartner.confirmPassword}
                    onChange={(e) => setNewPartner({...newPartner, confirmPassword: e.target.value})}
                    className="px-4 py-3 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={addPartner}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700"
                  >
                    <Save size={16} /> حفظ
                  </button>
                  <button 
                    type="button"
                    data-testid="admin-partner-form-cancel"
                    onClick={() => setShowPartnerForm(false)}
                    className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700"
                  >
                    <X size={16} /> إلغاء
                  </button>
                </div>
              </motion.div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Users size={20} /></div>
                  <span className="text-slate-500 text-sm font-medium">إجمالي الشركاء</span>
                </div>
                <div className="text-3xl font-bold">{stats.totalUsers}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><Clock size={20} /></div>
                  <span className="text-slate-500 text-sm font-medium">إجمالي المعدات</span>
                </div>
                <div className="text-3xl font-bold">{stats.totalEquipment}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center"><CreditCard size={20} /></div>
                  <span className="text-slate-500 text-sm font-medium">إيرادات معتمدة (إجمالي)</span>
                </div>
                <div className="text-3xl font-bold">{stats.monthlyRevenue.toLocaleString()} د.ع</div>
              </div>
            </div>

            {/* Partners Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-sm font-bold text-slate-600">الشريك</th>
                    <th className="p-4 text-sm font-bold text-slate-600">الهاتف</th>
                    <th className="p-4 text-sm font-bold text-slate-600">حالة الحساب</th>
                    <th className="p-4 text-sm font-bold text-slate-600">حالة الاشتراك</th>
                    <th className="p-4 text-sm font-bold text-slate-600">تاريخ الانتهاء</th>
                    <th className="p-4 text-sm font-bold text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {partners
                    .filter((p) => {
                      const q = partnerSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        String(p.name).toLowerCase().includes(q) ||
                        String(p.email).toLowerCase().includes(q) ||
                        String(p.phone || '').toLowerCase().includes(q)
                      );
                    })
                    .map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                            {p.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{p.name}</div>
                            <div className="text-sm text-slate-500">{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-600">{p.phone || 'غير محدد'}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                          p.status === 'approved' ? 'bg-green-100 text-green-700' : 
                          p.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {p.status === 'approved' ? 'موافق عليه' : p.status === 'pending' ? 'بانتظار الموافقة' : 'ملغي'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                          p.subStatus === 'active' ? 'bg-green-100 text-green-700' : 
                          p.subStatus === 'expired' ? 'bg-red-100 text-red-700' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {p.subStatus === 'active' ? 'نشط' : p.subStatus === 'expired' ? 'منتهي' : 'لا يوجد'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-600">{p.subEnd || 'غير محدد'}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {p.status === 'pending' && (
                            <button 
                              onClick={() => handleApprove(p.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="موافقة"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleRenewSubscription(p.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                            title="تجديد الاشتراك"
                          >
                            <CreditCard size={18} />
                          </button>
                          <button 
                            onClick={() =>
                              p.subStatus === 'banned' ? handleUnban(p.id) : handleBan(p.id)
                            }
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={p.subStatus === 'banned' ? 'إلغاء الحظر' : 'حظر'}
                          >
                            <Bell size={18} />
                          </button>
                          <button 
                            onClick={() => deletePartner(p.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-sm font-bold text-slate-600">الزبون</th>
                  <th className="p-4 text-sm font-bold text-slate-600">البريد</th>
                  <th className="p-4 text-sm font-bold text-slate-600">الهاتف</th>
                  <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                  <th className="p-4 text-sm font-bold text-slate-600">تاريخ التسجيل</th>
                  <th className="p-4 text-sm font-bold text-slate-600">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100" data-testid={`admin-customer-row-${c.id}`}>
                    <td className="p-4 font-bold text-slate-800">{c.name}</td>
                    <td className="p-4 text-sm text-slate-600">{c.email}</td>
                    <td className="p-4 text-sm text-slate-600">{c.phone}</td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${c.subscription_status === 'banned' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {c.subscription_status === 'banned' ? 'محظور' : 'نشط'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{c.joined}</td>
                    <td className="p-4">
                      {c.subscription_status === 'banned' ? (
                        <button
                          type="button"
                          data-testid={`admin-customer-unban-${c.id}`}
                          onClick={() => handleUnban(c.id)}
                          className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-bold hover:bg-green-100"
                        >
                          إلغاء الحظر
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`admin-customer-ban-${c.id}`}
                          onClick={() => handleBan(c.id)}
                          className="text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100"
                        >
                          حظر
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'couriers' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-testid="admin-couriers-tab">
            <div className="p-4 border-b border-slate-100 text-sm text-slate-500">
              حسابات المندوبين التي أنشأها الشركاء ({couriers.length})
            </div>
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-sm font-bold text-slate-600">المندوب</th>
                  <th className="p-4 text-sm font-bold text-slate-600">البريد</th>
                  <th className="p-4 text-sm font-bold text-slate-600">الهاتف</th>
                  <th className="p-4 text-sm font-bold text-slate-600">تاريخ الإنشاء</th>
                </tr>
              </thead>
              <tbody>
                {couriers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">لا يوجد مندوبون بعد</td>
                  </tr>
                )}
                {couriers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100" data-testid="admin-courier-row">
                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                      <Truck size={14} className="text-emerald-600" /> {c.name}
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-mono">{c.email}</td>
                    <td className="p-4 text-sm text-slate-600">{c.phone}</td>
                    <td className="p-4 text-sm text-slate-500">{c.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'bookings' && <AdminBookingsPanel />}

        {activeTab === 'equipment' && <AdminEquipmentPanel />}

        {activeTab === 'support' && <AdminSupportPanel />}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">معلومات التواصل</h3>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                    <Phone size={16} /> أرقام الهاتف
                  </label>
                  {editingInfo ? (
                    <div className="space-y-2">
                      {tempInfo.phones.map((phone: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              const newPhones = [...tempInfo.phones];
                              newPhones[index] = e.target.value;
                              setTempInfo({...tempInfo, phones: newPhones});
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            className="text-red-500 px-2"
                            onClick={() => setTempInfo({ ...tempInfo, phones: tempInfo.phones.filter((_: string, i: number) => i !== index) })}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-sm text-blue-600 font-bold"
                        onClick={() => setTempInfo({ ...tempInfo, phones: [...tempInfo.phones, ''] })}
                      >
                        + إضافة رقم
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {platformInfo.phones.map((phone: string, index: number) => (
                        <div key={index} className="text-blue-600 font-medium">{phone}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                    <Mail size={16} /> البريد الإلكتروني
                  </label>
                  {editingInfo ? (
                    <div className="space-y-2">
                      {tempInfo.emails.map((email: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              const newEmails = [...tempInfo.emails];
                              newEmails[index] = e.target.value;
                              setTempInfo({...tempInfo, emails: newEmails});
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            className="text-red-500 px-2"
                            onClick={() => setTempInfo({ ...tempInfo, emails: tempInfo.emails.filter((_: string, i: number) => i !== index) })}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-sm text-blue-600 font-bold"
                        onClick={() => setTempInfo({ ...tempInfo, emails: [...tempInfo.emails, ''] })}
                      >
                        + إضافة بريد
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {platformInfo.emails.map((email: string, index: number) => (
                        <div key={index} className="text-blue-600 font-medium">{email}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                    <MapPin size={16} /> العناوين
                  </label>
                  {editingInfo ? (
                    <div className="space-y-2">
                      {tempInfo.addresses.map((address: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => {
                              const newAddresses = [...tempInfo.addresses];
                              newAddresses[index] = e.target.value;
                              setTempInfo({...tempInfo, addresses: newAddresses});
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            className="text-red-500 px-2"
                            onClick={() => setTempInfo({ ...tempInfo, addresses: tempInfo.addresses.filter((_: string, i: number) => i !== index) })}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-sm text-blue-600 font-bold"
                        onClick={() => setTempInfo({ ...tempInfo, addresses: [...tempInfo.addresses, ''] })}
                      >
                        + إضافة عنوان
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {platformInfo.addresses.map((address: string, index: number) => (
                        <div key={index} className="text-slate-600 text-sm">{address}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Platform Content */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <h3 className="text-xl font-bold mb-6">محتوى المنصة</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">وصف المنصة</label>
                  {editingInfo ? (
                    <textarea
                      value={tempInfo.description}
                      onChange={(e) => setTempInfo({...tempInfo, description: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-slate-600">{platformInfo.description}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">مهمتنا</label>
                  {editingInfo ? (
                    <textarea
                      value={tempInfo.mission}
                      onChange={(e) => setTempInfo({...tempInfo, mission: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-slate-600">{platformInfo.mission}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 mb-2 block">رؤيتنا</label>
                  {editingInfo ? (
                    <textarea
                      value={tempInfo.vision}
                      onChange={(e) => setTempInfo({...tempInfo, vision: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-slate-600">{platformInfo.vision}</p>
                  )}
                </div>
              </div>

              {editingInfo && (
                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={async () => {
                      try {
                        const payload = {
                          name: tempInfo.name || platformInfo.name || 'إيجار',
                          description: tempInfo.description ?? '',
                          mission: tempInfo.mission ?? '',
                          vision: tempInfo.vision ?? '',
                          phones: (Array.isArray(tempInfo.phones) ? tempInfo.phones : [tempInfo.phones])
                            .map((x: string) => String(x || '').trim())
                            .filter(Boolean),
                          emails: (Array.isArray(tempInfo.emails) ? tempInfo.emails : [tempInfo.emails])
                            .map((x: string) => String(x || '').trim())
                            .filter(Boolean),
                          addresses: (Array.isArray(tempInfo.addresses) ? tempInfo.addresses : [tempInfo.addresses])
                            .map((x: string) => String(x || '').trim())
                            .filter(Boolean),
                          bank_name: tempInfo.bank_name ?? '',
                          bank_account_iban: tempInfo.bank_account_iban ?? '',
                          card_number_display: tempInfo.card_number_display ?? '',
                          transfer_instructions: tempInfo.transfer_instructions ?? '',
                          featured_ad_price: Number(tempInfo.featured_ad_price ?? 50000),
                          featured_duration_days: Number(tempInfo.featured_duration_days ?? 30),
                          subscription_renewal_price: Number(tempInfo.subscription_renewal_price ?? 100000),
                          commission_rate: Number(tempInfo.commission_rate ?? 0.1),
                        };
                        await apiJson('/api/admin/settings', {
                          method: 'POST',
                          body: JSON.stringify(payload)
                        });
                        setPlatformInfo({ ...platformInfo, ...payload });
                        setTempInfo({ ...platformInfo, ...payload });
                        setEditingInfo(false);
                        alert('تم حفظ التغييرات بنجاح');
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : 'فشل حفظ التغييرات';
                        if (/انتهت الجلسة|Invalid token|Unauthorized/i.test(msg)) {
                          alert('انتهت الجلسة. سجّل الدخول من جديد ثم أعد الحفظ.');
                          clearSession();
                          window.location.href = '/';
                          return;
                        }
                        alert(msg || 'فشل حفظ التغييرات');
                      }
                    }}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                  >
                    <Save size={16} />
                    حفظ التغييرات
                  </button>
                  <button 
                    onClick={() => {
                      setTempInfo({...platformInfo});
                      setEditingInfo(false);
                    }}
                    className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors"
                  >
                    <X size={16} />
                    إلغاء
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <AdminSettings />
        )}

        {/* Payments Tab Content */}
        {activeTab === 'payments' && (
          <PaymentsTab />
        )}

        {/* Stats Tab Content */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-700 mb-6">الإحصائيات والتقارير</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1">إجمالي الحجوزات</div>
                  <div className="text-3xl font-black text-slate-800">{stats.totalBookings}</div>
                </div>
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <BarChart3 size={28} />
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-500 mb-1">عمولة تقديرية (محاسبة فقط)</div>
                  <div className="text-3xl font-black text-green-600">{stats.totalCommission.toLocaleString()} د.ع</div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    الزبون يدفع للشريك مباشرة — هذا الرقم تقديري حسب نسبة الإعدادات، مو أرباح محصّلة في المنصة بعد.
                  </p>
                </div>
                <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                  <BarChart3 size={28} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h4 className="font-bold text-slate-800">الأكثر تأجيراً</h4>
              </div>
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-3 text-xs font-bold text-slate-500">المعدة</th>
                    <th className="p-3 text-xs font-bold text-slate-500">عدد الحجوزات</th>
                    <th className="p-3 text-xs font-bold text-slate-500">الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {mostRented.map((r) => (
                    <tr key={r.equipmentId} className="border-b border-slate-50">
                      <td className="p-3 text-sm font-bold text-slate-800">{r.title}</td>
                      <td className="p-3 text-sm">{r.bookingCount}</td>
                      <td className="p-3 text-sm font-bold">{r.totalRevenue.toLocaleString()} د.ع</td>
                    </tr>
                  ))}
                  {mostRented.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-sm text-slate-500">
                        لا توجد بيانات بعد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
