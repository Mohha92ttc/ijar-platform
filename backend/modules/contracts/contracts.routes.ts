import { Router } from 'express';
import { contractsController } from './contracts.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Static paths before /:id
router.post('/create', authenticateToken, contractsController.createContract);
router.get('/booking/:bookingId', authenticateToken, contractsController.getByBooking);
router.get('/templates', authenticateToken, contractsController.getContractTemplates);
router.post('/templates', authenticateToken, requireRole(['admin']), contractsController.createContractTemplate);
router.get('/analytics', authenticateToken, requireRole(['admin']), contractsController.getContractAnalytics);

router.get('/:id', authenticateToken, contractsController.getContract);
router.put('/:id', authenticateToken, requireRole(['admin', 'owner']), contractsController.updateContract);
router.delete('/:id', authenticateToken, requireRole(['admin']), contractsController.deleteContract);

router.post('/:id/sign', authenticateToken, contractsController.signContract);
router.post('/:id/verify', authenticateToken, contractsController.verifyContract);
router.get('/:id/status', authenticateToken, contractsController.getContractStatus);

export default router;
