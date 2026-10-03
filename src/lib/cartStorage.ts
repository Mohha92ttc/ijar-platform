const CART_PREFIX = 'ijar_cart_v1';

export type CartPaymentMethod = 'zain_cash' | 'asia_hawala' | 'manual' | 'cash_on_delivery';

export type CartLine = {
  id: string;
  title: string;
  category: string;
  price: number;
  location: string;
  image: string;
  owner_id?: string;
  days: number;
  startDate: string;
  endDate: string;
  /** إيجار فقط بدون توصيل */
  rentalTotal: number;
  /** رسوم توصيل (إن وُجدت) */
  deliveryFee: number;
  /** المجموع = إيجار + توصيل */
  total: number;
  paymentMethod: CartPaymentMethod;
  wantsDelivery: boolean;
};

function cartKey(userId?: string | null): string {
  return userId ? `${CART_PREFIX}:u:${userId}` : `${CART_PREFIX}:guest`;
}

export function loadCart(userId?: string | null): CartLine[] {
  try {
    const r = localStorage.getItem(cartKey(userId));
    if (!r) return [];
    const parsed = JSON.parse(r) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((line) => {
      const rentalTotal = Number(line.rentalTotal ?? line.total ?? 0);
      const deliveryFee = Number(line.deliveryFee ?? 0);
      return {
        ...line,
        rentalTotal,
        deliveryFee,
        total: Number(line.total ?? rentalTotal + deliveryFee),
        paymentMethod: line.paymentMethod || 'manual',
        wantsDelivery: Boolean(line.wantsDelivery),
      };
    });
  } catch {
    return [];
  }
}

export function saveCart(cart: CartLine[], userId?: string | null) {
  try {
    localStorage.setItem(cartKey(userId), JSON.stringify(cart));
  } catch {
    // ignore quota
  }
}

export function clearCartStorage(userId?: string | null) {
  try {
    localStorage.removeItem(cartKey(userId));
  } catch {
    // ignore
  }
}

/** عند تبديل الحساب: لا نشارك سلة زبون مع آخر */
export function switchCartUser(prevUserId: string | null | undefined, nextUserId: string | null | undefined): CartLine[] {
  if (prevUserId && nextUserId && prevUserId !== nextUserId) {
    // لا ننقل السلة بين حسابين مختلفين
    return loadCart(nextUserId);
  }
  if (!prevUserId && nextUserId) {
    // زائر يسجّل دخول: ننقل سلة الضيف لحسابه مرة واحدة ثم نفرّغ الضيف
    const guest = loadCart(null);
    if (guest.length > 0) {
      saveCart(guest, nextUserId);
      clearCartStorage(null);
      return guest;
    }
    return loadCart(nextUserId);
  }
  if (prevUserId && !nextUserId) {
    return loadCart(null);
  }
  return loadCart(nextUserId);
}

export function paymentMethodLabel(m: CartPaymentMethod): string {
  switch (m) {
    case 'zain_cash':
      return 'زين كاش';
    case 'asia_hawala':
      return 'زين حوالة / آسيا حوالة';
    case 'cash_on_delivery':
      return 'دفع عند التسليم';
    case 'manual':
    default:
      return 'تحويل يدوي (إثبات)';
  }
}
