import { Router } from 'express';
import { referralController } from './referral.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Referral codes (real)
router.post('/codes', authenticateToken, referralController.createReferralCode);
router.get('/codes', authenticateToken, referralController.getReferralCodes);
router.post('/codes/validate', referralController.validateReferralCode);
router.post('/codes/:code/use', authenticateToken, referralController.useReferralCode);

// Programs (stubs)
router.post(
  '/programs',
  authenticateToken,
  requireRole(['admin']),
  referralController.createReferralProgram
);
router.get('/programs', authenticateToken, referralController.getReferralPrograms);
router.get('/programs/:id', authenticateToken, referralController.getReferralProgram);
router.put(
  '/programs/:id',
  authenticateToken,
  requireRole(['admin']),
  referralController.updateReferralProgram
);
router.delete(
  '/programs/:id',
  authenticateToken,
  requireRole(['admin']),
  referralController.deleteReferralProgram
);

router.get('/transactions', authenticateToken, referralController.getReferralTransactions);
router.get(
  '/transactions/:userId',
  authenticateToken,
  referralController.getUserReferralTransactions
);

router.post(
  '/recommendations',
  authenticateToken,
  referralController.getPersonalizedRecommendations
);

export default router;
