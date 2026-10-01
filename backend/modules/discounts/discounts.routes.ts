import { Router } from 'express';
import { discountController } from './discount.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Discount campaigns
router.post('/campaigns', authenticateToken, requireRole(['admin']), discountController.createDiscountCampaign);
router.get('/campaigns', authenticateToken, discountController.getDiscountCampaigns);
router.get('/campaigns/:id', authenticateToken, discountController.getDiscountCampaign);
router.put('/campaigns/:id', authenticateToken, requireRole(['admin']), discountController.updateDiscountCampaign);
router.delete('/campaigns/:id', authenticateToken, requireRole(['admin']), discountController.deleteDiscountCampaign);

// Discount codes
router.post('/codes', authenticateToken, requireRole(['admin', 'owner']), discountController.createDiscountCode);
router.get('/codes', authenticateToken, discountController.getDiscountCodes);
router.post('/codes/validate', discountController.validateDiscountCode);
router.post('/codes/:code/use', authenticateToken, discountController.useDiscountCode);

// Loyalty programs
router.post('/loyalty', authenticateToken, requireRole(['admin']), discountController.createLoyaltyProgram);
router.get('/loyalty', authenticateToken, discountController.getLoyaltyPrograms);
router.get('/loyalty/:id', authenticateToken, discountController.getLoyaltyProgram);
router.put('/loyalty/:id', authenticateToken, requireRole(['admin']), discountController.updateLoyaltyProgram);

// User loyalty points
router.get('/loyalty/points/:userId', authenticateToken, discountController.getUserLoyaltyPoints);
router.post('/loyalty/points/:userId/add', authenticateToken, discountController.addLoyaltyPoints);

// Discount analytics
router.get('/analytics', authenticateToken, requireRole(['admin']), discountController.getDiscountAnalytics);

export default router;
