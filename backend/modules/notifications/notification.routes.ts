import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const controller = new NotificationController();

router.get('/user/:userId', authenticateToken, requireRole(['customer', 'owner', 'admin']), controller.getByUser);
router.patch('/:id/read', authenticateToken, requireRole(['customer', 'owner', 'admin']), controller.markAsRead);
router.patch('/user/:userId/read-all', authenticateToken, requireRole(['customer', 'owner', 'admin']), controller.markAllAsRead);
router.delete('/:id', authenticateToken, requireRole(['customer', 'owner', 'admin']), controller.delete);

export default router;
