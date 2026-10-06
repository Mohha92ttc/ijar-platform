import { Router } from 'express';
import { CouriersController } from './couriers.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const controller = new CouriersController();

// Partner: list / create
router.get('/', authenticateToken, requireRole(['owner']), controller.listMine);
router.post('/', authenticateToken, requireRole(['owner']), controller.create);

// Courier self routes MUST be before /:id
router.get('/me/profile', authenticateToken, requireRole(['courier']), controller.me);
router.get('/me/bookings', authenticateToken, requireRole(['courier']), controller.myBookings);
router.get('/me/report', authenticateToken, requireRole(['courier']), controller.myReport);
router.patch(
  '/me/bookings/:bookingId/status',
  authenticateToken,
  requireRole(['courier']),
  controller.updateDeliveryStatus
);

router.post(
  '/assign/:bookingId',
  authenticateToken,
  requireRole(['owner']),
  controller.assignBooking
);
router.post(
  '/request-return/:bookingId',
  authenticateToken,
  requireRole(['owner']),
  controller.requestReturn
);
router.post(
  '/cancel-return/:bookingId',
  authenticateToken,
  requireRole(['owner']),
  controller.cancelReturn
);
router.post(
  '/unassign/:bookingId',
  authenticateToken,
  requireRole(['owner']),
  controller.unassignBooking
);
router.post(
  '/mark-status/:bookingId',
  authenticateToken,
  requireRole(['owner']),
  controller.ownerMarkDelivery
);

router.patch('/:id', authenticateToken, requireRole(['owner']), controller.update);
router.patch('/:id/active', authenticateToken, requireRole(['owner']), controller.setActive);
router.post('/:id/reset-password', authenticateToken, requireRole(['owner']), controller.resetPassword);
router.get('/:id/report', authenticateToken, requireRole(['owner']), controller.partnerCourierReport);

export default router;
