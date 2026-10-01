export type EquipmentStatus = 'available' | 'rented' | 'maintenance' | 'hidden';

export interface Equipment {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  location: string;
  images: string[];
  status: EquipmentStatus;
  average_rating: number;
  review_count: number;
  created_at: Date;
  updated_at: Date;
  /** Present on list API when owner has active paid featured placement */
  owner_is_featured?: boolean;
}

export interface CreateEquipmentDTO {
  title: string;
  description: string;
  category: string;
  price_per_day: number;
  location: string;
  images?: string[];
}

export interface UpdateEquipmentDTO {
  title?: string;
  description?: string;
  category?: string;
  price_per_day?: number;
  location?: string;
  images?: string[];
  status?: EquipmentStatus;
}

export interface EquipmentSearchFilters {
  query?: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  startDate?: string; // ISO string for availability check
  endDate?: string;   // ISO string for availability check
}
