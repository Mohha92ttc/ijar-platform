/**
 * Compatibility facade + canonical NotificationService.
 * Advanced modules historically called sendNotification({ userId, type, title, message }).
 * Core app uses modules/notifications NotificationService.create().
 */
import { NotificationService as CoreNotificationService } from '../modules/notifications/notification.service';
import type { NotificationType } from '../modules/notifications/notification.types';

export class NotificationService extends CoreNotificationService {
  async sendNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: unknown;
    channels?: string[];
  }): Promise<void> {
    await this.create({
      user_id: data.userId,
      type: data.type as NotificationType,
      title: data.title,
      message: data.message,
      related_id:
        data.data && typeof data.data === 'object' && data.data !== null && 'related_id' in (data.data as object)
          ? String((data.data as { related_id?: string }).related_id)
          : undefined,
    });
  }
}

export type { CreateNotificationDTO as NotificationData } from '../modules/notifications/notification.types';
