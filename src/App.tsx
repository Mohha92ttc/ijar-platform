import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MapPin,
  Filter,
  Star,
  Plus,
  Bell,
  User,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  ShoppingCart,
  Briefcase,
  X,
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import PartnerDashboard from './components/PartnerDashboard';
import CustomerDashboard from './components/CustomerDashboard';
import BookingModal from './components/BookingModal';
import CheckoutPage from './components/CheckoutPage';
import AboutPage from './components/AboutPage';
import TermsPage from './components/TermsPage';
import HelpPage from './components/HelpPage';
import NotificationsPanel from './components/NotificationsPanel';
import { apiJson, clearSession, ApiError, apiLogout, friendlyAuthMessage, validateSession, apiFetch } from './lib/api';
import { loadCart, saveCart, clearCartStorage, switchCartUser, type CartLine, type CartPaymentMethod } from './lib/cartStorage';

type EquipmentRow = {
  id: string;
  title: string;
  category: string;
  price: number;
  location: string;
  rating: number;
  reviews: number;
  image: string;
  owner_id: string;
  /** يُعاد من الخادم عند تفعيل إعلان مميز مدفوع للشريك */
  owner_featured?: boolean;
};

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400';


function mapApiEquipment(e: Record<string, unknown>): EquipmentRow {
  const images = e.images as string[] | undefined;
  return {
    id: String(e.id),
    title: String(e.title),
    category: String(e.category),
    price: Number(e.price_per_day),
    location: String(e.location),
    rating: Number(e.average_rating ?? 0),
    reviews: Number(e.review_count ?? 0),
    image: images?.[0] || PLACEHOLDER_IMG,
    owner_featured: Boolean(e.owner_is_featured),
    owner_id: String(e.owner_id),
  };
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'home' | 'auth' | 'admin' | 'partner' | 'customer' | 'checkout' | 'about' | 'terms' | 'help'>('home');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRow | null>(null);
  const [selectedDeliveryFee, setSelectedDeliveryFee] = useState(0);
  const [categories, setCategories] = useState<string[]>(['الكل']);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [list, setList] = useState<EquipmentRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const cartReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await validateSession();
      if (cancelled) return;
      if (me) {
        setUser(me);
        setCart(loadCart(me.id));
        prevUserIdRef.current = me.id;
      } else {
        setUser(null);
        setCart(loadCart(null));
        prevUserIdRef.current = null;
      }
      cartReadyRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep Render awake while a browser tab is open (يشبه زيارة حقيقية)
  useEffect(() => {
    const ping = () => {
      const opts: RequestInit = { credentials: 'include', cache: 'no-store' };
      fetch('/api/health', opts).catch(() => {});
      fetch('/', { ...opts, headers: { Accept: 'text/html' } }).catch(() => {});
      fetch('/api/equipment', opts).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 4 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!cartReadyRef.current) return;
    saveCart(cart, user?.id ?? null);
  }, [cart, user?.id]);

  useEffect(() => {
    if (!cartReadyRef.current) return;
    const nextId = user?.id ?? null;
    const prev = prevUserIdRef.current;
    if (prev === undefined) {
      prevUserIdRef.current = nextId;
      return;
    }
    if (prev !== nextId) {
      setCart(switchCartUser(prev, nextId));
      prevUserIdRef.current = nextId;
    }
  }, [user?.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const refreshEquipment = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const raw = await apiJson<Record<string, unknown>[]>('/api/equipment');
      setList(raw.map(mapApiEquipment));
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'تعذر تحميل المعدات');
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const cats = await apiJson<any[]>('/api/equipment/categories');
      setCategories(['الكل', ...cats.map(c => c.name)]);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    refreshEquipment();
    refreshCategories();
  }, [refreshEquipment, refreshCategories]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    list.forEach((item) => {
      if (!m.has(item.owner_id)) {
        m.set(item.owner_id, `شريك ${item.owner_id.slice(0, 8)}…`);
      }
    });
    return Array.from(m.entries());
  }, [list]);

  const filteredEquipment = useMemo(() => {
    return list.filter((item) => {
      if (selectedOwnerId && item.owner_id !== selectedOwnerId) return false;
      if (activeCategory !== 'الكل' && item.category !== activeCategory) return false;
      const q = searchQ.trim().toLowerCase();
      if (q && !item.title.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return false;
      const min = priceMin ? Number(priceMin) : NaN;
      const max = priceMax ? Number(priceMax) : NaN;
      if (!Number.isNaN(min) && item.price < min) return false;
      if (!Number.isNaN(max) && item.price > max) return false;
      return true;
    });
  }, [list, selectedOwnerId, activeCategory, searchQ, priceMin, priceMax]);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setView('home');
  };

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setShowUserMenu(false);
    setView('home');
  };

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setView('auth');
      alert('انتهت الجلسة. سجّل الدخول من جديد.');
    };
    window.addEventListener('ijar:session-expired', onExpired);
    return () => window.removeEventListener('ijar:session-expired', onExpired);
  }, []);

  const openBooking = async (item: EquipmentRow) => {
    setSelectedEquipment(item);
    setSelectedDeliveryFee(0);
    if (item.owner_id) {
      try {
        const res = await apiFetch(`/api/payments/public-owner/${item.owner_id}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedDeliveryFee(Number(data.delivery_fee) || 0);
        }
      } catch {
        // ignore
      }
    }
  };

  const addToCart = (
    equipment: EquipmentRow,
    bookingData: {
      dates: { start: string; end: string };
      total: number;
      rentalTotal: number;
      deliveryFee: number;
      paymentMethod: CartPaymentMethod;
      wantsDelivery: boolean;
    }
  ) => {
    const s = new Date(bookingData.dates.start);
    const e = new Date(bookingData.dates.end);
    const days = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
    const line: CartLine = {
      id: equipment.id,
      title: equipment.title,
      category: equipment.category,
      price: equipment.price,
      location: equipment.location,
      image: equipment.image,
      owner_id: equipment.owner_id,
      days,
      startDate: bookingData.dates.start,
      endDate: bookingData.dates.end,
      rentalTotal: bookingData.rentalTotal,
      deliveryFee: bookingData.deliveryFee,
      total: bookingData.total,
      paymentMethod: bookingData.paymentMethod,
      wantsDelivery: bookingData.wantsDelivery,
    };
    setCart((prev) => [...prev.filter((x) => !(x.id === line.id && x.startDate === line.startDate)), line]);
    setSelectedEquipment(null);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    clearCartStorage(user?.id ?? null);
  };

  const handleCheckoutComplete = async (formData: {
    phone: string;
    location: string;
    notes: string;
    paymentMethod: CartPaymentMethod;
  }) => {
    if (!user?.id) {
      alert('يرجى تسجيل الدخول لإتمام الحجز');
      setView('auth');
      return;
    }
    if (user.role !== 'customer') {
      alert('الحجز يتم بحساب زبون فقط. سجّل دخولك كزبون (مو أدمن/شريك).');
      setView('auth');
      return;
    }
    setCheckoutError(null);
    setCheckoutSubmitting(true);
    try {
      for (const item of cart) {
        const payMethod = formData.paymentMethod || item.paymentMethod || 'manual';
        const booking = await apiJson<any>('/api/bookings', {
          method: 'POST',
          body: JSON.stringify({
            equipment_id: item.id,
            start_date: new Date(item.startDate).toISOString(),
            end_date: new Date(item.endDate).toISOString(),
            customerId: user.id,
            customer_phone: formData.phone,
            location: formData.location,
            notes: formData.notes,
            delivery_requested: item.wantsDelivery,
            delivery_fee: item.deliveryFee || 0,
            payment_preference: payMethod,
          }),
        });

        await apiJson('/api/payments/initiate', {
          method: 'POST',
          body: JSON.stringify({
            booking_id: booking.id,
            amount: item.total,
            payment_method: payMethod,
            notes: `بواسطة العميل: ${formData.phone} | ${payMethod}${item.wantsDelivery ? ' | توصيل' : ''}`,
          }),
        });
      }
      clearCart();
      setView('home');
      alert('تم تسجيل حجوزاتك بنجاح في النظام.');
    } catch (err) {
      const msg = friendlyAuthMessage(err instanceof ApiError ? err.message : 'فشل إرسال الحجز');
      setCheckoutError(msg);
      alert(msg);
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setView('auth');
      }
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  if (view === 'auth') return <AuthPage onLogin={handleLogin} />;
  if (view === 'admin') return <AdminDashboard onBack={() => setView('home')} />;
  if (view === 'partner') return <PartnerDashboard ownerId={user?.id} onBack={() => setView('home')} />;
  if (view === 'customer') return <CustomerDashboard userId={user?.id} userEmail={user?.email} onBack={() => setView('home')} />;
  if (view === 'about') return <AboutPage onBack={() => setView('home')} />;
  if (view === 'terms') return <TermsPage onBack={() => setView('home')} />;
  if (view === 'help') return <HelpPage onBack={() => setView('home')} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">إ</div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">إيجار</h1>
          </div>

          <div className="flex-1 max-w-2xl relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              data-testid="home-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="ابحث عن معدات، أدوات، أو مكائن..."
              className="w-full bg-slate-100 border-none rounded-xl py-2.5 pr-10 pl-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {cart.length > 0 && (
              <button
                type="button"
                data-testid="header-cart"
                onClick={() => setView('checkout')}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative"
              >
                <ShoppingCart size={22} />
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {cart.length}
                </span>
              </button>
            )}

            {user && (
              <div className="flex items-center gap-4">
                <button type="button" data-testid="header-notifications" onClick={() => setShowNotifications(true)} className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <Bell className="text-slate-600" size={20} />
                </button>
                <div className="relative" ref={menuRef}>
                  <button type="button" data-testid="header-user-menu" onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{user.name?.[0] ?? '؟'}</div>
                    <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user.name}</span>
                    <ChevronDown className="text-slate-400" size={16} />
                  </button>

                  {showUserMenu && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                      {user.role === 'customer' && (
                        <button type="button" onClick={() => { setView('customer'); setShowUserMenu(false); }} className="w-full px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <User size={16} />
                          لوحة التحكم
                        </button>
                      )}
                      {user.role === 'owner' && (
                        <button type="button" onClick={() => { setView('partner'); setShowUserMenu(false); }} className="w-full px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <Briefcase size={16} />
                          لوحة التحكم
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button type="button" onClick={() => { setView('admin'); setShowUserMenu(false); }} className="w-full px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <LayoutDashboard size={16} />
                          لوحة التحكم
                        </button>
                      )}
                      <button type="button" onClick={handleLogout} className="w-full px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                        <LogOut size={16} />
                        تسجيل الخروج
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
            {!user && (
              <button type="button" data-testid="header-auth" onClick={() => setView('auth')} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
                دخول / تسجيل
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <select
              data-testid="home-filter-owner"
              value={selectedOwnerId ?? ''}
              onChange={(e) => {
                setSelectedOwnerId(e.target.value || null);
                setActiveCategory('الكل');
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all bg-white border border-slate-200 max-w-[220px]"
            >
              <option value="">كل الشركاء</option>
              {ownerOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === cat ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium shrink-0 ${showFilter ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Filter size={16} />
              تصفية السعر
            </button>
            <button type="button" data-testid="home-refresh-list" onClick={() => refreshEquipment()} className="text-sm text-blue-600 font-medium hover:underline">
              تحديث القائمة
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilter && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} className="flex flex-wrap items-end gap-4 p-4 bg-white rounded-xl border border-slate-200">
              <div>
                <label className="text-xs text-slate-500 block mb-1">أقل سعر (د.ع / يوم)</label>
                <input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-36" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">أعلى سعر</label>
                <input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-36" />
              </div>
              <button type="button" onClick={() => { setPriceMin(''); setPriceMax(''); }} className="text-sm text-slate-600 underline">
                مسح السعر
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-blue-600 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-lg">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">أجر معداتك وابدأ بالربح اليوم</h2>
            <p className="text-blue-100 mb-6 text-sm sm:text-base">حول معداتك غير المستخدمة إلى مصدر دخل إضافي. انضم إلى مئات أصحاب المعدات في العراق.</p>
            <button type="button" data-testid="home-hero-register" onClick={() => setView('auth')} className="bg-white text-blue-600 px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors">
              <Plus size={18} />
              أضف معداتك الآن
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500 rounded-full opacity-20" />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">المعدات المتاحة</h3>
            <button
              type="button"
              onClick={() => {
                setSearchQ('');
                setActiveCategory('الكل');
                setSelectedOwnerId(null);
                setPriceMin('');
                setPriceMax('');
              }}
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              عرض الكل
            </button>
          </div>

          {listError && <div className="p-4 bg-red-50 text-red-800 rounded-xl text-sm">{listError}</div>}
          {loadingList && <div className="text-slate-500 text-sm">جاري تحميل المعدات…</div>}

          {!loadingList && !listError && filteredEquipment.length === 0 && <div className="text-slate-500 text-center py-12">لا توجد نتائج مطابقة.</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredEquipment.map((item) => (
              <motion.div key={item.id} whileHover={{ y: -4 }} className="bg-white rounded-2xl overflow-hidden border border-slate-200 card-shadow card-shadow-hover cursor-pointer group">
                <div className="aspect-[4/3] relative overflow-hidden" onClick={() => setSelectedEquipment(item)}>
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    <span className="bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700">{item.category}</span>
                    {item.owner_featured && (
                      <span data-testid="equipment-featured-badge" className="bg-amber-400/95 text-slate-900 px-2 py-1 rounded-lg text-[10px] font-bold">
                        مميز
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star size={14} fill="currentColor" />
                      <span className="text-xs font-bold">{item.rating}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={12} /> {item.location.split(' - ')[0]}
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 mb-3 line-clamp-1">{item.title}</h4>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-lg font-bold text-blue-600">{item.price.toLocaleString()}</span>
                      <span className="text-xs text-slate-500 mr-1">د.ع / يوم</span>
                    </div>
                    <button
                      type="button"
                      data-testid="equipment-book"
                      onClick={() => openBooking(item)}
                      className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors"
                    >
                      حجز
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {selectedEquipment && (
          <BookingModal
            equipment={selectedEquipment}
            deliveryFee={selectedDeliveryFee}
            onClose={() => setSelectedEquipment(null)}
            onConfirm={(data) => addToCart(selectedEquipment, data)}
          />
        )}
        {view === 'checkout' && (
          <CheckoutPage
            cart={cart}
            onRemove={removeFromCart}
            onClear={clearCart}
            onClose={() => { setCheckoutError(null); setView('home'); }}
            onComplete={handleCheckoutComplete}
            submitting={checkoutSubmitting}
            error={checkoutError}
          />
        )}
        <NotificationsPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} userId={user?.id} />
      </AnimatePresence>

      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">إ</div>
            <span className="font-bold text-slate-700">إيجار</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-500">
            <button type="button" data-testid="footer-about" onClick={() => setView('about')} className="hover:text-blue-600">
              عن المنصة
            </button>
            <button type="button" data-testid="footer-terms" onClick={() => setView('terms')} className="hover:text-blue-600">
              الشروط
            </button>
            <button type="button" data-testid="footer-help" onClick={() => setView('help')} className="hover:text-blue-600">
              المساعدة
            </button>
          </div>
          <p className="text-xs text-slate-400">© ٢٠٢٦ منصة إيجار لتأجير المعدات. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
}
