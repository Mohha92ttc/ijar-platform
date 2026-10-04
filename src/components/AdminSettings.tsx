import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, User, Mail, Phone, Lock, Save, X, ShieldCheck } from 'lucide-react';
import { User as UserType } from '../types';
import { apiJson, ApiError } from '../lib/api';

interface AdminCredentials {
  username: string;
  email: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function AdminSettings() {
  const [credentials, setCredentials] = useState<AdminCredentials>({
    username: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [platformBank, setPlatformBank] = useState({
    bank_name: '',
    bank_account_iban: '',
    card_number_display: '',
    zain_cash_phone: '',
    account_holder_name: '',
    transfer_instructions: '',
    featured_ad_price: 50000,
    featured_duration_days: 30,
    subscription_renewal_price: 100000,
    commission_rate: 0.1,
  });

  React.useEffect(() => {
    (async () => {
      try {
        const data = await apiJson<UserType>('/api/auth/me');
        setCredentials(prev => ({
          ...prev,
          username: data.name || '',
          email: data.email || '',
          phone: data.phone || ''
        }));
      } catch (err) {
        // Handle silently
      }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const d = await apiJson<Record<string, unknown>>('/api/admin/settings');
        setPlatformBank({
          bank_name: String(d.bank_name ?? ''),
          bank_account_iban: String(d.bank_account_iban ?? ''),
          card_number_display: String(d.card_number_display ?? ''),
          zain_cash_phone: String(d.zain_cash_phone ?? ''),
          account_holder_name: String(d.account_holder_name ?? ''),
          transfer_instructions: String(d.transfer_instructions ?? ''),
          featured_ad_price: Number(d.featured_ad_price ?? 50000),
          featured_duration_days: Number(d.featured_duration_days ?? 30),
          subscription_renewal_price: Number(d.subscription_renewal_price ?? 100000),
          commission_rate: Number(d.commission_rate ?? 0.1),
        });
      } catch {
        // غير مسموح أو غير مسجّل كمدير
      }
    })();
  }, []);

  const handleSavePlatformBank = async () => {
    try {
      setLoading(true);
      const full = await apiJson<Record<string, unknown>>('/api/admin/settings');
      await apiJson('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          ...full,
          ...platformBank,
          featured_ad_price: Number(platformBank.featured_ad_price),
          featured_duration_days: Number(platformBank.featured_duration_days),
          subscription_renewal_price: Number(platformBank.subscription_renewal_price),
          commission_rate: Number(platformBank.commission_rate),
        }),
      });
      alert('تم حفظ حسابات التحويل والأسعار.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'فشل الحفظ';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (!credentials.username || !credentials.email) {
      alert('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }
    try {
      setLoading(true);
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: credentials.username,
          email: credentials.email,
          phone: credentials.phone
        })
      });
      alert('تم تحديث معلومات الملف الشخصي بنجاح!');
      setShowProfileForm(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'فشل التحديث';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!credentials.currentPassword || !credentials.newPassword) {
      alert('يرجى إدخال كلمة المرور الحالية والجديدة');
      return;
    }

    if (credentials.newPassword !== credentials.confirmPassword) {
      alert('كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    if (credentials.newPassword.length < 8) {
      alert('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    try {
      setLoading(true);
      await apiJson('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: credentials.currentPassword,
          newPassword: credentials.newPassword
        })
      });
      alert('تم تغيير كلمة المرور بنجاح!');
      setCredentials({
        ...credentials,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'فشل تغيير كلمة المرور';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Profile Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-blue-600" size={24} />
            <h3 className="text-lg font-bold">معلومات حساب المدير</h3>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="text-slate-400" size={18} />
                <div>
                  <div className="text-sm text-slate-500">اسم المستخدم</div>
                  <div className="font-bold">{credentials.username}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="text-slate-400" size={18} />
                <div>
                  <div className="text-sm text-slate-500">البريد الإلكتروني</div>
                  <div className="font-bold">{credentials.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="text-slate-400" size={18} />
                <div>
                  <div className="text-sm text-slate-500">رقم الهاتف</div>
                  <div className="font-bold">{credentials.phone}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-3">
              <button 
                onClick={() => setShowProfileForm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
              >
                <Settings size={16} />
                تعديل الملف الشخصي
              </button>
              <button 
                type="button"
                data-testid="admin-open-password-modal"
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700"
              >
                <Lock size={16} />
                تغيير كلمة المرور
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* منصة: حسابات التحويل وأسعار الخدمات (تظهر للشركاء) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" data-testid="admin-platform-bank-panel">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-amber-600" size={24} />
            <h3 className="text-lg font-bold">حسابات استلام دفعات الشركاء</h3>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            الشريك يحوّل لك (ماستركارد / زين كاش / بنك) عند الإعلان المميز أو تجديد الاشتراك — بنفس آلية الزبون مع الشريك.
          </p>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم صاحب الحساب</label>
            <input
              type="text"
              data-testid="admin-account-holder"
              value={platformBank.account_holder_name}
              onChange={(e) => setPlatformBank({ ...platformBank, account_holder_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="الاسم كما يظهر على البطاقة / المحفظة"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رقم ماستركارد / فيزا</label>
            <input
              type="text"
              data-testid="admin-bank-card"
              value={platformBank.card_number_display}
              onChange={(e) => setPlatformBank({ ...platformBank, card_number_display: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              placeholder="XXXX XXXX XXXX XXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رقم زين كاش</label>
            <input
              type="text"
              data-testid="admin-zain-cash"
              value={platformBank.zain_cash_phone}
              onChange={(e) => setPlatformBank({ ...platformBank, zain_cash_phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              placeholder="07xxxxxxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم البنك</label>
            <input
              type="text"
              data-testid="admin-bank-name"
              value={platformBank.bank_name}
              onChange={(e) => setPlatformBank({ ...platformBank, bank_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رقم الحساب / الآيبان</label>
            <input
              type="text"
              data-testid="admin-bank-iban"
              value={platformBank.bank_account_iban}
              onChange={(e) => setPlatformBank({ ...platformBank, bank_account_iban: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">سعر الإعلان المميز (د.ع)</label>
            <input
              type="number"
              data-testid="admin-featured-price"
              value={platformBank.featured_ad_price}
              onChange={(e) => setPlatformBank({ ...platformBank, featured_ad_price: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">مدة الإعلان (أيام)</label>
            <input
              type="number"
              data-testid="admin-featured-days"
              value={platformBank.featured_duration_days}
              onChange={(e) => setPlatformBank({ ...platformBank, featured_duration_days: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">سعر تجديد الاشتراك (د.ع)</label>
            <input
              type="number"
              data-testid="admin-subscription-price"
              value={platformBank.subscription_renewal_price}
              onChange={(e) => setPlatformBank({ ...platformBank, subscription_renewal_price: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عمولة المنصة (نسبة، مثال 0.10 = 10%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              data-testid="admin-commission-rate"
              value={platformBank.commission_rate}
              onChange={(e) => setPlatformBank({ ...platformBank, commission_rate: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">تعليمات التحويل للشركاء</label>
            <textarea
              data-testid="admin-bank-instructions"
              value={platformBank.transfer_instructions}
              onChange={(e) => setPlatformBank({ ...platformBank, transfer_instructions: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              rows={3}
              placeholder="مثال: حوّل عبر زين كاش ثم ارفع صورة الإثبات خلال 24 ساعة"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              data-testid="admin-platform-bank-save"
              disabled={loading}
              onClick={handleSavePlatformBank}
              className="bg-amber-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ…' : 'حفظ حسابات التحويل والأسعار'}
            </button>
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showProfileForm && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileForm(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">تعديل الملف الشخصي</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  value={credentials.phone}
                  onChange={(e) => setCredentials({...credentials, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                disabled={loading}
                onClick={handleProfileUpdate}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button
                disabled={loading}
                onClick={() => setShowProfileForm(false)}
                className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700"
              >
                <X size={16} />
                إلغاء
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Password Change Modal */}
      {showPasswordForm && (
        <motion.div
          data-testid="admin-password-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPasswordForm(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">تغيير كلمة المرور</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور الحالية</label>
                <input
                  type="password"
                  data-testid="admin-password-current"
                  value={credentials.currentPassword}
                  onChange={(e) => setCredentials({...credentials, currentPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="أدخل كلمة المرور الحالية"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  data-testid="admin-password-new"
                  value={credentials.newPassword}
                  onChange={(e) => setCredentials({...credentials, newPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="أدخل كلمة المرور الجديدة"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
                <input
                  type="password"
                  data-testid="admin-password-confirm"
                  value={credentials.confirmPassword}
                  onChange={(e) => setCredentials({...credentials, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="أعد إدخال كلمة المرور الجديدة"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                disabled={loading}
                onClick={handlePasswordUpdate}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50"
              >
                <Save size={16} />
                {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </button>
              <button
                disabled={loading}
                onClick={() => setShowPasswordForm(false)}
                className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700"
              >
                <X size={16} />
                إلغاء
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
