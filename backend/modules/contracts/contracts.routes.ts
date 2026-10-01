import { Router } from 'express';
import { contractsController } from './contracts.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Digital contract management
router.post('/create', authenticateToken, contractsController.createContract);
router.get('/:id', authenticateToken, contractsController.getContract);
router.put('/:id', authenticateToken, requireRole(['admin', 'owner']), contractsController.updateContract);
router.delete('/:id', authenticateToken, requireRole(['admin', 'owner']), contractsController.deleteContract);

// Contract signing and verification
router.post('/:id/sign', authenticateToken, contractsController.signContract);
router.post('/:id/verify', authenticateToken, contractsController.verifyContract);
router.get('/:id/status', authenticateToken, contractsController.getContractStatus);

// Contract templates
router.get('/templates', authenticateToken, contractsController.getContractTemplates);
router.post('/templates', authenticateToken, requireRole(['admin']), contractsController.createContractTemplate);

// Contract analytics
router.get('/analytics', authenticateToken, requireRole(['admin']), contractsController.getContractAnalytics);

export default router;
