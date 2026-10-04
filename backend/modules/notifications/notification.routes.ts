import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const controller = new NotificationController();

router.get('/user/:userId', authenticateToken, requireRole(['customer', 'owner', 'admin', 'courier']), controller.getByUser);
router.patch('/:id/read', authenticateToken, requireRole(['customer', 'owner', 'admin', 'courier']), controller.markAsRead);
router.patch('/user/:userId/read-all', authenticateToken, requireRole(['customer', 'owner', 'admin', 'courier']), controller.markAllAsRead);
router.delete('/:id', authenticateToken, requireRole(['customer', 'owner', 'admin', 'courier']), controller.delete);

export default router;
