import React, { useState, useEffect } from 'react';
import { User, Calendar, MapPin, Star, Settings, LogOut, Home, Truck, Phone } from 'lucide-react';
import { apiJson } from '../lib/api';

type Row = {
  id: string;
  equipment: string;
  partner: string;
  dates: string;
  total: number;
  status: string;
  location: string;
  deliveryRequested?: boolean;
  deliveryStatus?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
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

export default function CustomerDashboard({
  userId,
  userEmail,
  onBack,
}: {
  userId?: string;
  userEmail?: string;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState('rentals');
  const [bookings, setBookings] = useState<Row[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoadingBookings(true);
      try {
        const raw = await apiJson<any[]>(`/api/bookings/customer/${userId}`);
        const rows: Row[] = raw.map((b) => {
          const ds = `${new Date(b.start_date).toLocaleDateString('ar-IQ')} – ${new Date(b.end_date).toLocaleDateString('ar-IQ')}`;
          return {
            id: b.id,
            equipment: b.equipment_title || '—',
            partner: b.owner_name || '—',
            dates: ds,
            total: Number(b.total_amount),
            status: b.status,
            location: b.delivery_address || b.location || b.equipment_location || '—',
            deliveryRequested: Boolean(b.delivery_requested),
            deliveryStatus: b.delivery_status ? String(b.delivery_status) : null,
            courierName: b.courier_name ? String(b.courier_name) : null,
            courierPhone: b.courier_phone ? String(b.courier_phone) : null,
          };
        });
        if (!cancelled) setBookings(rows);
      } catch {
        if (!cancelled) setBookings([]);
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
      try {
        const prof = await apiJson<any>('/api/auth/me');
        if (!cancelled) setProfile(prof);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'مؤكد';
      case 'pending': return 'في الانتظار';
      case 'cancelled': return 'ملغي';
      case 'completed': return 'مكتمل';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white">
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
          <button 
            type="button"
            data-testid="customer-nav-rentals"
            onClick={() => setActiveTab('rentals')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'rentals' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Calendar size={18} /> حجوزاتي
          </button>
          <button 
            type="button"
            data-testid="customer-nav-favorites"
            onClick={() => setActiveTab('favorites')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'favorites' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Star size={18} /> المفضلة
          </button>
          <button 
            type="button"
            data-testid="customer-nav-profile"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'profile' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <User size={18} /> الملف الشخصي
          </button>
          <button 
            type="button"
            data-testid="customer-nav-settings"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-colors w-full text-right ${
              activeTab === 'settings' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Settings size={18} /> الإعدادات
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            type="button"
            data-testid="customer-back-home"
            onClick={onBack}
            className="flex items-center gap-3 p-3 rounded-xl text-sm font-bold hover:bg-slate-800 text-slate-400 w-full text-right"
          >
            <LogOut size={18} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">
            {activeTab === 'rentals' && 'حجوزاتي'}
            {activeTab === 'favorites' && 'المعدات المفضلة'}
            {activeTab === 'profile' && 'الملف الشخصي'}
            {activeTab === 'settings' && 'الإعدادات'}
          </h2>
        </header>

        {/* Rentals Tab */}
        {activeTab === 'rentals' && (
          <div className="space-y-6">
            {loadingBookings && <p className="text-sm text-slate-500">جاري تحميل الحجوزات…</p>}
            {!loadingBookings && bookings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <Calendar className="mx-auto text-slate-400 mb-4" size={48} />
                <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد حجوزات حالياً</h3>
                <p className="text-slate-500">ابدأ باستكشاف المعدات المتاحة للحجز</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-4 text-sm font-bold text-slate-600">المعدات</th>
                        <th className="p-4 text-sm font-bold text-slate-600">الشريك</th>
                        <th className="p-4 text-sm font-bold text-slate-600">التواريخ</th>
                        <th className="p-4 text-sm font-bold text-slate-600">الموقع</th>
                        <th className="p-4 text-sm font-bold text-slate-600">التوصيل</th>
                        <th className="p-4 text-sm font-bold text-slate-600">الإجمالي</th>
                        <th className="p-4 text-sm font-bold text-slate-600">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid="customer-booking-row">
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{booking.equipment}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-600">{booking.partner}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-600">{booking.dates}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-600 flex items-center gap-1">
                              <MapPin size={12} className="shrink-0" /> {booking.location}
                            </div>
                          </td>
                          <td className="p-4">
                            {booking.deliveryRequested ? (
                              <div className="space-y-1" data-testid="customer-delivery-status">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                  <Truck size={10} /> {deliveryLabel(booking.deliveryStatus)}
                                </span>
                                {booking.courierName && (
                                  <div className="text-[11px] text-slate-600 flex items-center gap-1">
                                    <Phone size={10} />
                                    {booking.courierName}
                                    {booking.courierPhone ? ` · ${booking.courierPhone}` : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">بدون توصيل</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{booking.total.toLocaleString()} د.ع</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${getStatusColor(booking.status)}`}>
                              {getStatusLabel(booking.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="space-y-6">
            {favorites.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <Star className="mx-auto text-slate-400 mb-4" size={48} />
                <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد معدات مفضلة</h3>
                <p className="text-slate-500">أضف معدات إلى المفضلة للوصول السريع</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="h-48 bg-slate-200"></div>
                    <div className="p-4">
                      <h3 className="font-bold text-slate-800 mb-2">{item.title}</h3>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500">{item.category}</span>
                        <div className="flex items-center gap-1">
                          <Star className="text-amber-400 fill-current" size={14} />
                          <span className="text-sm text-slate-600">{item.rating}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-500 mb-3">{item.partner}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-blue-600">{item.price.toLocaleString()} د.ع/يوم</span>
                        <button className="text-red-500 hover:text-red-600">
                          <Star size={20} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6" data-testid="customer-profile-panel">
            <h3 className="text-lg font-bold mb-6">الملف الشخصي</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">الاسم الكامل</label>
                <input type="text" value={profile?.name || 'العميل'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">البريد الإلكتروني</label>
                <input type="email" value={profile?.email || userEmail || ''} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">رقم الهاتف</label>
                <input type="tel" value={profile?.phone || '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">تاريخ الانضمام</label>
                <input type="text" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ar-IQ') : '—'} readOnly className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50" />
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold mb-6">الإعدادات</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-bold">الإشعارات</div>
                  <div className="text-sm text-slate-500">تلقي إشعارات حول الحجوزات والعروض</div>
                </div>
                <button type="button" data-testid="customer-settings-notify" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">تفعيل</button>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-bold">اللغة</div>
                  <div className="text-sm text-slate-500">اختيار لغة التطبيق</div>
                </div>
                <select data-testid="customer-settings-lang" className="px-4 py-2 border border-slate-200 rounded-lg">
                  <option>العربية</option>
                  <option>English</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
