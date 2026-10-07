import { Router } from 'express';
import { discountController } from './discount.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Discount codes (real)
router.get(
  '/codes',
  authenticateToken,
  requireRole(['admin']),
  discountController.getDiscountCodes
);
router.post(
  '/codes',
  authenticateToken,
  requireRole(['admin']),
  discountController.createDiscountCode
);
router.post('/codes/validate', discountController.validateDiscountCode);
router.patch(
  '/codes/:id',
  authenticateToken,
  requireRole(['admin']),
  discountController.deactivateDiscountCode
);

// Legacy: consume via booking create instead
router.post(
  '/codes/:code/use',
  authenticateToken,
  discountController.useDiscountCode
);

// Discount campaigns (stubs — use codes)
router.post(
  '/campaigns',
  authenticateToken,
  requireRole(['admin']),
  discountController.createDiscountCampaign
);
router.get('/campaigns', authenticateToken, discountController.getDiscountCampaigns);
router.get('/campaigns/:id', authenticateToken, discountController.getDiscountCampaign);
router.put(
  '/campaigns/:id',
  authenticateToken,
  requireRole(['admin']),
  discountController.updateDiscountCampaign
);
router.delete(
  '/campaigns/:id',
  authenticateToken,
  requireRole(['admin']),
  discountController.deleteDiscountCampaign
);

// Loyalty programs (stubs)
router.post(
  '/loyalty',
  authenticateToken,
  requireRole(['admin']),
  discountController.createLoyaltyProgram
);
router.get('/loyalty', authenticateToken, discountController.getLoyaltyPrograms);
router.get('/loyalty/:id', authenticateToken, discountController.getLoyaltyProgram);
router.put(
  '/loyalty/:id',
  authenticateToken,
  requireRole(['admin']),
  discountController.updateLoyaltyProgram
);
router.get(
  '/loyalty/points/:userId',
  authenticateToken,
  discountController.getUserLoyaltyPoints
);
router.post(
  '/loyalty/points/:userId/add',
  authenticateToken,
  discountController.addLoyaltyPoints
);

router.get(
  '/analytics',
  authenticateToken,
  requireRole(['admin']),
  discountController.getDiscountAnalytics
);

export default router;
