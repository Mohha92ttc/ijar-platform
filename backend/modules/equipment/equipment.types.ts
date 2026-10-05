export type EquipmentStatus = 'available' | 'rented' | 'maintenance' | 'hidden';

export interface Equipment {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  location: string;
  governorate?: string | null;
  area?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  images: string[];
  status: EquipmentStatus;
  average_rating: number;
  review_count: number;
  created_at: Date;
  updated_at: Date;
  /** Present on list API when owner has active paid featured placement */
  owner_is_featured?: boolean;
  /** اسم الشريك للعرض والبحث */
  owner_name?: string;
}

export interface PublicPartner {
  id: string;
  name: string;
  equipment_count: number;
  locations: string[];
  featured: boolean;
}

export interface CreateEquipmentDTO {
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  location: string;
  governorate?: string;
  area?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  images?: string[];
}

export interface UpdateEquipmentDTO {
  title?: string;
  description?: string;
  category?: string;
  price_per_day?: number;
  location?: string;
  governorate?: string;
  area?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  images?: string[];
  status?: EquipmentStatus;
}

export interface EquipmentSearchFilters {
  query?: string;
  category?: string;
  location?: string;
  governorate?: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  startDate?: string;
  endDate?: string;
}
