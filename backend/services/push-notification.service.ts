import webpush from 'web-push';
import { query } from '../database/connection';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class PushNotificationService {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  constructor() {
    this.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
    
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      console.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  async saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    try {
      const sql = `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          endpoint = $2,
          p256dh = $3,
          auth = $4,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await query(sql, [
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth
      ]);
    } catch (error) {
      console.error('Error saving push subscription:', error);
      throw error;
    }
  }

  async removeSubscription(userId: string): Promise<void> {
    const sql = 'DELETE FROM push_subscriptions WHERE user_id = $1';
    await query(sql, [userId]);
  }

  async sendPushNotification(userId: string, payload: PushNotificationPayload): Promise<void> {
    try {
      // Get user's push subscription
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        console.log('No push subscription found for user:', userId);
        return;
      }

      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      };

      // Send the push notification
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        {
          vapidDetails: {
            subject: `mailto:${process.env.EMAIL_FROM || 'noreply@ijar.iq'}`,
            publicKey: this.vapidPublicKey,
            privateKey: this.vapidPrivateKey,
          },
          TTL: 24 * 60 * 60, // 24 hours
          urgency: 'normal',
          topic: payload.tag
        }
      );

      console.log('Push notification sent successfully to user:', userId);
    } catch (error) {
      console.error('Error sending push notification:', error);

      // If subscription is no longer valid, remove it
      if ((error as any).statusCode === 410) {
        await this.removeSubscription(userId);
      }

      throw error;
    }
  }

  async sendBulkPushNotifications(userIds: string[], payload: PushNotificationPayload): Promise<void> {
    const promises = userIds.map(userId => 
      this.sendPushNotification(userId, payload).catch(error => {
        console.error(`Failed to send push notification to user ${userId}:`, error);
      })
    );
    
    await Promise.allSettled(promises);
  }

  private async getUserSubscription(userId: string) {
    const sql = `
      SELECT endpoint, p256dh, auth 
      FROM push_subscriptions 
      WHERE user_id = $1
    `;
    
    const result = await query(sql, [userId]);
    return result.rows[0];
  }

  async sendBookingNotification(userId: string, bookingData: any): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'حجز جديد',
      body: `تم تأكيد حجز ${bookingData.equipmentName} من ${bookingData.dates}`,
      icon: '/icons/booking-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `booking-${bookingData.id}`,
      data: {
        type: 'booking',
        bookingId: bookingData.id,
        equipmentId: bookingData.equipmentId
      },
      actions: [
        {
          action: 'view',
          title: 'عرض الحجز',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'contact',
          title: 'التواصل',
          icon: '/icons/contact-icon.png'
        }
      ]
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendPaymentNotification(userId: string, paymentData: any): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'تحديث الدفع',
      body: `تم ${paymentData.status} دفعة بقيمة ${paymentData.amount} د.ع`,
      icon: '/icons/payment-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `payment-${paymentData.id}`,
      data: {
        type: 'payment',
        paymentId: paymentData.id
      },
      actions: [
        {
          action: 'view',
          title: 'عرض الدفعة',
          icon: '/icons/view-icon.png'
        }
      ]
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendPartnerApprovalNotification(userId: string, approvalData: any): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'تحديث طلب الانضمام',
      body: `طلب الانضمام ${approvalData.status}`,
      icon: '/icons/partner-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `partner-${userId}`,
      data: {
        type: 'partner_approval',
        status: approvalData.status
      },
      actions: [
        {
          action: 'view',
          title: 'عرض الطلب',
          icon: '/icons/view-icon.png'
        }
      ]
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendReviewNotification(userId: string, reviewData: any): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'تقييم جديد',
      body: `تلقيت تقييم ${reviewData.rating}/5 على ${reviewData.equipmentName}`,
      icon: '/icons/review-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `review-${reviewData.id}`,
      data: {
        type: 'review',
        reviewId: reviewData.id,
        equipmentId: reviewData.equipmentId
      },
      actions: [
        {
          action: 'view',
          title: 'عرض التقييم',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'respond',
          title: 'رد',
          icon: '/icons/respond-icon.png'
        }
      ]
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendMessageNotification(userId: string, messageData: any): Promise<void> {
    const payload: PushNotificationPayload = {
      title: 'رسالة جديدة',
      body: `رسالة من ${messageData.senderName}: ${messageData.content.substring(0, 100)}...`,
      icon: '/icons/message-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `message-${messageData.id}`,
      data: {
        type: 'message',
        messageId: messageData.id,
        senderId: messageData.senderId
      },
      actions: [
        {
          action: 'view',
          title: 'عرض الرسالة',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'reply',
          title: 'رد',
          icon: '/icons/reply-icon.png'
        }
      ]
    };

    await this.sendPushNotification(userId, payload);
  }

  async sendSystemNotification(userId: string, systemData: any): Promise<void> {
    const payload: PushNotificationPayload = {
      title: systemData.title,
      body: systemData.message,
      icon: '/icons/system-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `system-${Date.now()}`,
      data: {
        type: 'system'
      },
      actions: [
        {
          action: 'view',
          title: 'عرض التفاصيل',
          icon: '/icons/view-icon.png'
        }
      ]
    };

    await this.sendPushNotification(userId, payload);
  }

  generateVapidKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys();
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }
}

export default new PushNotificationService();
