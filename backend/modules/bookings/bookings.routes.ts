import { Router } from 'express';
import { BookingController } from './bookings.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();
const bookingController = new BookingController();

// Customer routes
router.post('/', authenticateToken, requireRole(['customer']), bookingController.create);
router.get('/availability', bookingController.checkAvailability);
router.get('/busy-ranges', bookingController.getBusyRanges);
router.get('/customer/:customerId', authenticateToken, requireRole(['customer', 'admin']), bookingController.getByCustomer);
router.get('/equipment/:equipmentId', authenticateToken, requireRole(['customer', 'owner', 'admin']), bookingController.getByEquipment);
router.get('/owner/:ownerId', authenticateToken, requireRole(['owner', 'admin']), bookingController.getByOwner);

// Single booking (after static path segments)
router.get('/:id', authenticateToken, requireRole(['customer', 'owner', 'admin']), bookingController.getById);
router.patch('/:id/status', authenticateToken, requireRole(['owner', 'admin', 'customer']), bookingController.updateStatus);

export default router;
