import { Request, Response } from 'express';
import { aiService } from './ai.service';

export const aiController = {
  // AI-powered recommendations
  async getRecommendations(req: Request, res: Response) {
    try {
      const { userId, equipmentType, location } = req.body;
      const personalized = await aiService.getPersonalizedRecommendations(userId, equipmentType, location);
      res.json({ personalized });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  },

  async predictDemand(req: Request, res: Response) {
    try {
      const { timeRange, equipmentCategory, location } = req.body;
      const predictions = await aiService.predictEquipmentDemand(timeRange, equipmentCategory, location);
      res.json(predictions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to predict demand' });
    }
  },

  async predictChurn(req: Request, res: Response) {
    try {
      const { timeRange } = req.body;
      const churnPredictions = await aiService.predictCustomerChurn(timeRange);
      res.json(churnPredictions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to predict churn' });
    }
  },

  async predictRevenue(req: Request, res: Response) {
    try {
      const { timeRange, equipmentIds } = req.body;
      const revenuePredictions = await aiService.predictRevenue(timeRange, equipmentIds);
      res.json(revenuePredictions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to predict revenue' });
    }
  },

  async analyzeSentiment(req: Request, res: Response) {
    try {
      const { reviews, feedback } = req.body;
      const sentimentAnalysis = await aiService.analyzeSentiment(reviews, feedback);
      res.json(sentimentAnalysis);
    } catch (error) {
      res.status(500).json({ error: 'Failed to analyze sentiment' });
    }
  },

  async optimizePricing(req: Request, res: Response) {
    try {
      const { equipmentIds, marketData, demandData } = req.body;
      const optimizedPricing = await aiService.optimizePricing(equipmentIds, marketData, demandData);
      res.json(optimizedPricing);
    } catch (error) {
      res.status(500).json({ error: 'Failed to optimize pricing' });
    }
  },

  // AI-powered search and matching
  async smartSearch(req: Request, res: Response) {
    try {
      const { query, filters, userId } = req.body;
      const searchResults = await aiService.smartSearch(query, filters, userId);
      res.json(searchResults);
    } catch (error) {
      res.status(500).json({ error: 'Failed to perform smart search' });
    }
  },

  async matchEquipment(req: Request, res: Response) {
    try {
      const { requirements, preferences, location } = req.body;
      const matches = await aiService.findBestEquipmentMatch(requirements, preferences, location);
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: 'Failed to match equipment' });
    }
  },

  async personalizeContent(req: Request, res: Response) {
    try {
      const { userId, contentType } = req.body;
      const personalizedContent = await aiService.generatePersonalizedContent(userId, contentType);
      res.json(personalizedContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to personalize content' });
    }
  },

  // Analytics and insights
  async getAnalyticsOverview(req: Request, res: Response) {
    try {
      const overview = await aiService.getAnalyticsOverview();
      res.json(overview);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get analytics overview' });
    }
  },

  async getUserBehaviorAnalytics(req: Request, res: Response) {
    try {
      const { timeRange, userSegment } = req.body;
      const behaviorAnalytics = await aiService.getUserBehaviorAnalytics(timeRange, userSegment);
      res.json(behaviorAnalytics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user behavior analytics' });
    }
  },

  async getMarketTrends(req: Request, res: Response) {
    try {
      const { timeRange, region, equipmentCategory } = req.body;
      const marketTrends = await aiService.getMarketTrends(timeRange, region, equipmentCategory);
      res.json(marketTrends);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get market trends' });
    }
  }
};
