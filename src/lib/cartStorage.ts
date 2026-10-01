const CART_KEY = 'ijar_cart_v1';

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
  total: number;
};

export function loadCart(): CartLine[] {
  try {
    const r = localStorage.getItem(CART_KEY);
    if (!r) return [];
    const parsed = JSON.parse(r) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartLine[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
