import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// توصيات: GET عام للصفحة الرئيسية؛ POST للمستخدم المسجّل
router.get('/recommendations', aiController.getRecommendations);
router.post('/recommendations', authenticateToken, aiController.getRecommendations);
router.get('/search', authenticateToken, aiController.smartSearch);
router.post('/smart-search', authenticateToken, aiController.smartSearch);

router.post('/demand-prediction', authenticateToken, requireRole(['admin', 'owner']), aiController.predictDemand);
router.post('/churn-prediction', authenticateToken, requireRole(['admin']), aiController.predictChurn);
router.post('/revenue-prediction', authenticateToken, requireRole(['admin', 'owner']), aiController.predictRevenue);
router.post('/sentiment-analysis', authenticateToken, aiController.analyzeSentiment);
router.post('/pricing-optimization', authenticateToken, requireRole(['admin', 'owner']), aiController.optimizePricing);

router.post('/equipment-matching', authenticateToken, aiController.matchEquipment);
router.post('/user-personalization', authenticateToken, aiController.personalizeContent);

router.get('/analytics/overview', authenticateToken, requireRole(['admin']), aiController.getAnalyticsOverview);
router.get('/analytics/user-behavior', authenticateToken, requireRole(['admin']), aiController.getUserBehaviorAnalytics);
router.get('/analytics/market-trends', authenticateToken, requireRole(['admin', 'owner']), aiController.getMarketTrends);

export default router;
