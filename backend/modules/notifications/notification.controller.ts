import { Request, Response } from 'express';
import { NotificationService } from './notification.service';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

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
