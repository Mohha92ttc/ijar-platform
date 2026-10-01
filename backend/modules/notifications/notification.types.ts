export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_received'
  | 'new_review'
  | 'system'
  | 'booking'
  | 'payment'
  | 'partner_approval'
  | 'review'
  | 'message';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  related_id?: string;
  created_at: Date;
}

export interface CreateNotificationDTO {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_id?: string;
}
