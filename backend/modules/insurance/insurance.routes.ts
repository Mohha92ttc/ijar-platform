import { Router } from 'express';
import { insuranceController } from './insurance.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Policies (stubs)
router.post('/policies', authenticateToken, insuranceController.createPolicy);
router.get('/policies', authenticateToken, insuranceController.getPolicies);
router.get('/policies/:id', authenticateToken, insuranceController.getPolicy);
router.put('/policies/:id', authenticateToken, requireRole(['admin']), insuranceController.updatePolicy);
router.delete('/policies/:id', authenticateToken, requireRole(['admin']), insuranceController.deletePolicy);

// Claims (real)
router.post('/claims', authenticateToken, requireRole(['customer', 'admin']), insuranceController.createClaim);
router.get('/claims', authenticateToken, insuranceController.getClaims);
router.get('/claims/:id', authenticateToken, insuranceController.getClaim);
router.put('/claims/:id', authenticateToken, requireRole(['admin']), insuranceController.updateClaim);
router.post('/claims/:id/approve', authenticateToken, requireRole(['admin']), insuranceController.approveClaim);
router.post('/claims/:id/reject', authenticateToken, requireRole(['admin']), insuranceController.rejectClaim);

router.get('/analytics', authenticateToken, requireRole(['admin']), insuranceController.getInsuranceAnalytics);

export default router;
