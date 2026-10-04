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

router.patch('/:id/active', authenticateToken, requireRole(['owner']), controller.setActive);
router.get('/:id/report', authenticateToken, requireRole(['owner']), controller.partnerCourierReport);

export default router;
