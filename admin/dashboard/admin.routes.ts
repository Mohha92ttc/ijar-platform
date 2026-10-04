import { Router } from 'express';
import { AdminController } from './admin.controller';

import { authenticateToken, requireRole } from '../../backend/modules/auth/auth.middleware';

const router = Router();
const adminController = new AdminController();

// All admin routes are protected
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Dashboard & Analytics
router.get('/stats', adminController.getDashboard);

// User Management
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.patch('/users/:id/ban', adminController.banUser);
router.patch('/users/:id/unban', adminController.unbanUser);
router.patch('/users/:id/approve', adminController.approveUser);
router.post('/users/:id/renew', adminController.renewSubscription);
router.delete('/users/:id', adminController.deleteUser);

// Equipment Management
router.patch('/equipment/:id/status', adminController.manageEquipment);

// Booking & Payment Overviews
router.get('/bookings', adminController.getAllBookings);
router.get('/payments', adminController.getAllPayments);
router.post('/payments/:id/review', adminController.reviewPayment);
router.get('/partner-payments-report', adminController.getPartnerPaymentsReport);
router.get('/password-reset-requests', adminController.getPasswordResetRequests);
router.post('/password-reset-requests/:id/review', adminController.reviewPasswordResetRequest);

// Platform Settings
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);
router.get('/readiness', adminController.getReadiness);

export default router;
