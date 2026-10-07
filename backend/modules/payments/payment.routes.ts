import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';
import { validatePaymentRequest, validateImageUpload } from './payment.validation';

const router = Router();
const controller = new PaymentController();

// Customer routes
router.post(
  '/initiate',
  authenticateToken,
  requireRole(['customer']),
  validatePaymentRequest,
  validateImageUpload,
  controller.initiate
);
router.get('/owner-settings/:ownerId', authenticateToken, requireRole(['owner', 'admin']), controller.getOwnerSettings);
// Public: delivery fee + wallet/phone for checkout (no bank secrets)
router.get('/public-owner/:ownerId', controller.getPublicOwnerInfo);

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
router.get(
  '/my-earnings',
  authenticateToken,
  requireRole(['owner']),
  controller.myBookingEarnings
);
router.post(
  '/:id/settle-refund',
  authenticateToken,
  requireRole(['owner']),
  controller.ownerSettleRefund
);
router.post(
  '/booking/:bookingId/reject-proof',
  authenticateToken,
  requireRole(['owner']),
  controller.ownerRejectProof
);

// Admin routes
router.get('/reviews', authenticateToken, requireRole(['admin']), controller.getPendingReviews);
router.post('/:id/review', authenticateToken, requireRole(['admin']), controller.review);

export default router;
