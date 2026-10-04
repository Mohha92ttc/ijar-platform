import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Phone, Lock, ArrowRight, Briefcase, ShieldCheck } from 'lucide-react';
import { apiJson, setSession, ApiError, apiLogout, clearSession } from '../lib/api';

import { UserRole } from '../types';

export default function AuthPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [newForgotPassword, setNewForgotPassword] = useState('');
  const [completionToken, setCompletionToken] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setFormData({ name: '', email: '', phone: '', password: '' });
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) {
        await apiLogout();
        clearSession();
        const data = await apiJson<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
          '/api/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
          }
        );
        if (!data.token) {
          throw new ApiError('لم يُرجع الخادم توكن جلسة', 500);
        }
        setSession(data.token, data.user);
        onLogin(data.user);
      } else {
        const data = await apiJson<{
          token?: string;
          pending?: boolean;
          message?: string;
          user?: { id: string; name: string; email: string; role: string };
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || undefined,
            password: formData.password,
            role: role,
          }),
        });
        if (data.pending || !data.token || !data.user) {
          setInfoMessage(data.message || 'تم إنشاء الحساب وبانتظار موافقة الإدارة.');
          setIsLogin(true);
          return;
        }
        setSession(data.token, data.user);
        onLogin(data.user);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'حدث خطأ في الاتصال بالخادم';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitForgotRequest = async () => {
    if (!forgotEmail) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiJson('/api/auth/forgot-password-approval', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotStatus('pending');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'فشل إرسال الطلب';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const checkForgotStatus = async () => {
    if (!forgotEmail) return;
    try {
      const data = await apiJson<{ status: string }>('/api/auth/forgot-password-status?email=' + encodeURIComponent(forgotEmail));
      if (data.status === 'approved') setForgotStatus('approved');
      else if (data.status === 'rejected') setForgotStatus('rejected');
      else if (data.status === 'pending') setForgotStatus('pending');
      else setForgotStatus('idle');
    } catch {
      // ignore
    }
  };

  const completeForgotReset = async () => {
    if (newForgotPassword.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (!completionToken || completionToken.length < 20) {
      setError('أدخل رمز التأكيد المرسل بعد موافقة الإدارة');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiJson('/api/auth/reset-password-approved', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail,
          newPassword: newForgotPassword,
          completionToken,
        }),
      });
      alert('تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.');
      setForgotMode(false);
      setForgotStatus('idle');
      setNewForgotPassword('');
      setCompletionToken('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'فشل تحديث كلمة المرور';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden border border-slate-100"
      >
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">إ</div>
          </div>

          <h2 className="text-2xl font-bold text-center mb-2">
            {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h2>
          {infoMessage && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-center" data-testid="auth-info">
              {infoMessage}
            </p>
          )}
          <p className="text-slate-500 text-center text-sm mb-8">
            {isLogin ? 'مرحباً بك مجدداً في منصة إيجار' : 'انضم إلى أكبر سوق لتأجير المعدات'}
          </p>

          {isLogin && (
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed text-center" data-testid="auth-courier-hint">
              المندوب يدخل بنفس الشاشة بالبريد وكلمة المرور التي يولّدها الشريك عند إنشاء حسابه.
            </p>
          )}

          {!isLogin && (
            <div className="space-y-2 mb-6">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  data-testid="auth-role-customer"
                  onClick={() => setRole('customer')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${role === 'customer' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                >
                  <User size={16} /> زبون
                </button>
                <button
                  type="button"
                  data-testid="auth-role-owner"
                  onClick={() => setRole('owner')}
                  className={`w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${role === 'owner' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'text-slate-500'}`}
                >
                  <Briefcase size={16} /> شريك
                </button>
              </div>
            </div>
          )}

          {role === 'owner' && !isLogin && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="text-blue-600" size={20} />
                <h4 className="font-bold text-blue-800">التسجيل كشريك تجاري</h4>
              </div>
              <p className="text-sm text-blue-700 leading-relaxed">
                عبّئ الاسم والبريد والهاتف وكلمة المرور أدناه ثم اضغط إنشاء حساب. بعد موافقة الإدارة تدفع الاشتراك من لوحة الشريك بحسابات التحويل الحقيقية للمنصة.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right space-y-2">
              <div>{error}</div>
              {(error.includes('Email verification') || error.includes('التحقق') || error.includes('verification')) && (
                <button
                  type="button"
                  data-testid="auth-resend-verification"
                  className="text-xs font-bold underline text-blue-700"
                  onClick={async () => {
                    if (!formData.email) {
                      setError('أدخل البريد أولاً');
                      return;
                    }
                    try {
                      await apiJson('/api/auth/resend-verification', {
                        method: 'POST',
                        body: JSON.stringify({ email: formData.email }),
                      });
                      setInfoMessage('إن وُجد الحساب غير المؤكد، أُرسل رابط التحقق إلى بريدك.');
                      setError(null);
                    } catch (e) {
                      setError(e instanceof ApiError ? e.message : 'تعذر إعادة الإرسال');
                    }
                  }}
                >
                  إعادة إرسال رابط التحقق
                </button>
              )}
            </div>
          )}

          {!forgotMode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                data-testid="auth-email"
                placeholder="البريد الإلكتروني"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            {!isLogin && (
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="tel"
                  placeholder="رقم الهاتف"
                  required={role !== 'admin'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            )}
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                data-testid="auth-password"
                placeholder="كلمة المرور"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              data-testid="auth-submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? 'جاري المعالجة...' : isLogin ? 'دخول' : 'إنشاء الحساب'}
              <ArrowRight size={18} className="rotate-180" />
            </button>
          </form>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  data-testid="forgot-email"
                  placeholder="البريد المرتبط بالحساب"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
              {forgotStatus === 'approved' ? (
                <>
                  <input
                    type="text"
                    data-testid="forgot-completion-token"
                    placeholder="رمز التأكيد (من الإيميل أو الإدارة)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-mono"
                    value={completionToken}
                    onChange={(e) => setCompletionToken(e.target.value.trim())}
                  />
                  <input
                    type="password"
                    data-testid="forgot-new-password"
                    placeholder="كلمة المرور الجديدة"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm"
                    value={newForgotPassword}
                    onChange={(e) => setNewForgotPassword(e.target.value)}
                  />
                  <button type="button" data-testid="forgot-complete" onClick={completeForgotReset} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm">تحديث كلمة المرور</button>
                </>
              ) : (
                <>
                  <button type="button" data-testid="forgot-request" onClick={submitForgotRequest} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm">إرسال طلب موافقة</button>
                  <button type="button" data-testid="forgot-check-status" onClick={checkForgotStatus} className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm">تحقق من الحالة</button>
                  {forgotStatus === 'pending' && <p className="text-xs text-amber-700">الحالة: بانتظار موافقة الإدارة</p>}
                  {forgotStatus === 'rejected' && <p className="text-xs text-red-700">الحالة: تم رفض الطلب</p>}
                </>
              )}
            </div>
          )}

          <div className="mt-8 text-center">
            {isLogin && (
              <button
                type="button"
                data-testid="auth-open-forgot"
                onClick={() => { setForgotMode(!forgotMode); setError(null); }}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium mb-3 block w-full"
              >
                {forgotMode ? 'العودة لتسجيل الدخول' : 'نسيت كلمة المرور؟'}
              </button>
            )}
            <button
              type="button"
              data-testid="auth-toggle-mode"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-slate-500 hover:text-blue-600 font-medium"
            >
              {isLogin ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
