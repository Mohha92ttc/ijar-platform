import { Response } from 'express';
import { aiService } from './ai.service';
import { AuthenticatedRequest } from '../auth/auth.middleware';

function uid(req: AuthenticatedRequest): string | undefined {
  return req.user?.userId || req.user?.id;
}

export const aiController = {
  /** GET/POST توصيات حسب الشعبية */
  async getRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId =
        uid(req) ||
        String(req.body?.userId || req.query?.userId || '').trim() ||
        undefined;
      const limit = Number(req.body?.limit || req.query?.limit || 8);
      const data = await aiService.getRecommendations(userId, limit);
      res.json(data);
    } catch (error) {
      console.error('getRecommendations', error);
      res.status(500).json({ error: 'فشل جلب التوصيات' });
    }
  },

  /** بحث مساعد ILIKE */
  async smartSearch(req: AuthenticatedRequest, res: Response) {
    try {
      const q = String(req.body?.query || req.query?.q || req.query?.query || '').trim();
      const limit = Number(req.body?.limit || req.query?.limit || 20);
      const data = await aiService.searchAssist(q, limit);
      res.json(data);
    } catch (error) {
      console.error('smartSearch', error);
      res.status(500).json({ error: 'فشل البحث' });
    }
  },

  async predictDemand(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.predictEquipmentDemand(
        req.body?.timeRange,
        req.body?.equipmentCategory
      );
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل إحصاء الطلب' });
    }
  },

  async predictChurn(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.predictCustomerChurn(req.body?.timeRange);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل إحصاء العملاء غير النشطين' });
    }
  },

  async predictRevenue(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.predictRevenue(req.body?.timeRange);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل جلب إيرادات الحجوزات' });
    }
  },

  async analyzeSentiment(_req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.analyzeSentiment();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل ملخص التقييمات' });
    }
  },

  async optimizePricing(_req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.optimizePricing();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل ملاحظات التسعير' });
    }
  },

  async matchEquipment(req: AuthenticatedRequest, res: Response) {
    try {
      const requirements = {
        category: req.body?.requirements?.category || req.body?.category,
        maxPrice: req.body?.requirements?.maxPrice ?? req.body?.maxPrice,
      };
      const data = await aiService.findBestEquipmentMatch(requirements);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل مطابقة المعدات' });
    }
  },

  async personalizeContent(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req) || String(req.body?.userId || '').trim() || undefined;
      const data = await aiService.generatePersonalizedContent(userId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل التوصيات الشخصية' });
    }
  },

  async getAnalyticsOverview(_req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.getAnalyticsOverview();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل النظرة العامة' });
    }
  },

  async getUserBehaviorAnalytics(_req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.getUserBehaviorAnalytics();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل تحليل السلوك' });
    }
  },

  async getMarketTrends(_req: AuthenticatedRequest, res: Response) {
    try {
      const data = await aiService.getMarketTrends();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'فشل اتجاهات السوق' });
    }
  },
};
