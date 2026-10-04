import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle, MessageCircle, User, Calendar, DollarSign } from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';

type ApiNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_id?: string | null;
};

function localizeNotification(n: ApiNotification): { title: string; message: string } {
  const titleMap: Record<string, string> = {
    'New Booking Request': 'طلب حجز جديد',
    'Booking Confirmed': 'تم تأكيد الحجز',
    'Booking Cancelled': 'تم إلغاء الحجز',
  };
  let title = titleMap[n.title] || n.title;
  let message = n.message;
  message = message
    .replace(/^You have a new booking request for (.+)\.$/, 'لديك طلب حجز جديد على «$1».')
    .replace(/^Your booking for (.+) has been confirmed\.$/, 'تم تأكيد حجزك لـ «$1».')
    .replace(/^Your booking for (.+) has been cancelled\.$/, 'أُلغي حجزك لـ «$1».')
    .replace(/^The booking for (.+) has been cancelled\.$/, 'أُلغي الحجز على «$1».');
  return { title, message };
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  userId,
  onOpenRelated,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onOpenRelated?: (n: { related_id?: string | null; type: string }) => void;
}) {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const prefsOff = (() => {
    try {
      const raw = localStorage.getItem(`ijar_customer_prefs_${userId || 'anon'}`);
      if (!raw) return false;
      const p = JSON.parse(raw);
      return p.notifyOn === false;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!isOpen || !userId || prefsOff) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/notifications/user/${userId}`);
        const data = (await res.json()) as ApiNotification[];
        if (!cancelled) setNotifications(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId, prefsOff]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await apiJson(`/api/notifications/user/${userId}/read-all`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking_confirmed':
      case 'booking_cancelled':
        return <Calendar className="text-blue-500" size={18} />;
      case 'payment':
        return <DollarSign className="text-green-500" size={18} />;
      case 'message':
        return <MessageCircle className="text-purple-500" size={18} />;
      default:
        return <User className="text-slate-500" size={18} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex justify-end"
          data-testid="notifications-panel"
        >
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <motion.div
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center gap-2">
              <div className="flex items-center gap-3">
                <Bell className="text-blue-600" size={24} />
                <div>
                  <h3 className="font-bold text-lg">الإشعارات</h3>
                  <p className="text-xs text-slate-500">
                    {prefsOff ? 'معطّلة من الإعدادات' : unreadCount > 0 ? `${unreadCount} غير مقروء` : 'لا جديد'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!prefsOff && userId && unreadCount > 0 && (
                  <button
                    type="button"
                    data-testid="notifications-mark-all"
                    onClick={markAllRead}
                    className="text-[11px] font-bold text-blue-700 px-2 py-1 hover:bg-blue-50 rounded-lg"
                  >
                    قراءة الكل
                  </button>
                )}
                <button type="button" data-testid="notifications-close" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {prefsOff && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4 text-center" data-testid="notifications-prefs-off">
                  عطّلت تذكير الإشعارات من الإعدادات. فعّله لعرض القائمة هنا.
                </p>
              )}
              {!prefsOff && !userId && <p className="text-sm text-slate-500 text-center py-8">سجّل الدخول لعرض الإشعارات من الخادم.</p>}
              {!prefsOff && userId && loading && <p className="text-sm text-slate-500 text-center py-8">جاري التحميل…</p>}
              {!prefsOff && userId && !loading && notifications.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">لا توجد إشعارات بعد.</p>
              )}
              {!prefsOff &&
                notifications.map((n) => {
                  const loc = localizeNotification(n);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      data-testid="notification-item"
                      onClick={async () => {
                        await markAsRead(n.id);
                        if (n.related_id && onOpenRelated) {
                          onOpenRelated({ related_id: n.related_id, type: n.type });
                          onClose();
                        }
                      }}
                      className={`w-full text-right p-4 rounded-xl border transition-all ${n.is_read ? 'bg-slate-50 border-slate-100' : 'bg-blue-50 border-blue-100'}`}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1">{getNotificationIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 mb-1">{loc.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{loc.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">{new Date(n.created_at).toLocaleString('ar-IQ')}</p>
                        </div>
                        {!n.is_read && <CheckCircle className="text-blue-500 shrink-0" size={16} />}
                      </div>
                    </button>
                  );
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
