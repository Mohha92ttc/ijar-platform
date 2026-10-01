import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const controller = new PaymentController();

// Customer routes
router.post('/initiate', authenticateToken, requireRole(['customer']), controller.initiate);
router.get('/owner-settings/:ownerId', authenticateToken, requireRole(['owner', 'admin']), controller.getOwnerSettings);

// Owner routes
router.post('/settings', authenticateToken, requireRole(['owner', 'admin']), controller.updateOwnerSettings);
router.post(
  '/partner-platform',
  authenticateToken,
  requireRole(['owner']),
  controller.partnerPlatformSubmit
);
router.get(
  '/my-platform',
  authenticateToken,
  requireRole(['owner']),
  controller.myPlatformPayments
);

// Admin routes
router.get('/reviews', authenticateToken, requireRole(['admin']), controller.getPendingReviews);
router.post('/:id/review', authenticateToken, requireRole(['admin']), controller.review);

export default router;
