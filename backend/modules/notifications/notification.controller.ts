import { Request, Response } from 'express';
import { NotificationService } from './notification.service';
import pushNotificationService from '../../services/push-notification.service';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  getVapidPublicKey = async (_req: Request, res: Response) => {
    try {
      const publicKey = pushNotificationService.getVapidPublicKey();
      if (!publicKey) {
        return res.status(503).json({ error: 'إشعارات الدفع غير مفعّلة على الخادم' });
      }
      res.json({ publicKey });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'تعذر جلب مفتاح VAPID' });
    }
  };

  subscribePush = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const subscription = req.body?.subscription || req.body;
      const endpoint = subscription?.endpoint;
      const keys = subscription?.keys;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'اشتراك الدفع غير صالح' });
      }
      await pushNotificationService.saveSubscription(actor.userId, {
        endpoint: String(endpoint),
        keys: {
          p256dh: String(keys.p256dh),
          auth: String(keys.auth),
        },
      });
      res.status(201).json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'تعذر حفظ الاشتراك' });
    }
  };

  unsubscribePush = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await pushNotificationService.removeSubscription(actor.userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'تعذر إلغاء الاشتراك' });
    }
  };

  getByUser = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const requestedUserId = req.params.userId;
      if (actor.role !== 'admin' && requestedUserId !== actor.userId) {
        return res.status(403).json({ message: 'Not allowed' });
      }
      const notifications = await this.notificationService.getByUser(requestedUserId);
      res.status(200).json(notifications);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  markAsRead = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      await this.notificationService.markAsRead(id, actor.userId);
      res.status(200).json({ message: 'Notification marked as read' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  markAllAsRead = async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      await this.notificationService.markAllAsRead(actor.userId);
      res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actor = (req as any).user as { userId?: string; role?: string } | undefined;
      if (!actor?.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (actor.role === 'admin') {
        await this.notificationService.delete(id);
      } else {
        await this.notificationService.delete(id, actor.userId);
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };
}
