export type DeliveryStatus = 'pending_assign' | 'assigned' | 'out_for_delivery' | 'delivered' | 'failed';

export interface Courier {
  id: string;
  owner_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  email?: string | null;
  is_active: boolean;
  created_at: Date;
}

export interface CreateCourierDTO {
  name: string;
  phone: string;
  email: string;
  password?: string;
}
