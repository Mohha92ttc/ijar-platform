import { Request, Response } from 'express';

export const discountController = {
  // Discount campaigns
  async createDiscountCampaign(req: Request, res: Response) {
    try {
      const { name, description, discountType, discountValue, startDate, endDate, conditions } = req.body;
      const campaign = {
        id: 'campaign_001',
        name,
        description,
        discountType,
        discountValue,
        startDate,
        endDate,
        conditions,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create discount campaign' });
    }
  },

  async getDiscountCampaigns(req: Request, res: Response) {
    try {
      const campaigns = [
        {
          id: 'campaign_001',
          name: 'خصم رمضان',
          description: 'خصم 10% على جميع المعدات',
          discountType: 'percentage',
          discountValue: 10,
          status: 'active'
        }
      ];
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get discount campaigns' });
    }
  },

  async getDiscountCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const campaign = {
        id: 'campaign_001',
        name: 'خصم رمضان',
        description: 'خصم 10% على جميع المعدات',
        discountType: 'percentage',
        discountValue: 10,
        status: 'active'
      };
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get discount campaign' });
    }
  },

  async updateDiscountCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedCampaign = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update discount campaign' });
    }
  },

  async deleteDiscountCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      res.json({ message: 'Discount campaign deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete discount campaign' });
    }
  },

  // Discount codes
  async createDiscountCode(req: Request, res: Response) {
    try {
      const { campaignId, code, discountType, discountValue, expiryDate, usageLimit } = req.body;
      const discountCode = {
        id: 'discount_001',
        campaignId,
        code,
        discountType,
        discountValue,
        expiryDate,
        usageLimit,
        used: 0,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      res.status(201).json(discountCode);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create discount code' });
    }
  },

  async getDiscountCodes(req: Request, res: Response) {
    try {
      const codes = [
        {
          id: 'discount_001',
          campaignId: 'campaign_001',
          code: 'SUMMER20',
          discountType: 'percentage',
          discountValue: 20,
          expiryDate: '2024-12-31',
          usageLimit: 50,
          used: 15,
          status: 'active'
        }
      ];
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get discount codes' });
    }
  },

  async validateDiscountCode(req: Request, res: Response) {
    try {
      const { code } = req.body;
      const validation = {
        isValid: true,
        code: 'SUMMER20',
        campaignId: 'campaign_001',
        discountValue: 20,
        remainingUses: 35
      };
      res.json(validation);
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate discount code' });
    }
  },

  async useDiscountCode(req: Request, res: Response) {
    try {
      const { code, userId, bookingId } = req.body;
      const usage = {
        success: true,
        discountApplied: 20,
        discountCode: code,
        userId,
        bookingId
      };
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: 'Failed to use discount code' });
    }
  },

  // Loyalty programs
  async createLoyaltyProgram(req: Request, res: Response) {
    try {
      const { name, description, pointsPerCurrency, tierBenefits } = req.body;
      const loyaltyProgram = {
        id: 'loyalty_001',
        name,
        description,
        pointsPerCurrency,
        tierBenefits,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      res.status(201).json(loyaltyProgram);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create loyalty program' });
    }
  },

  async getLoyaltyPrograms(req: Request, res: Response) {
    try {
      const programs = [
        {
          id: 'loyalty_001',
          name: 'برنامج الولاء',
          description: 'اكسب نقاط مع كل حجزء',
          pointsPerCurrency: 1,
          tierBenefits: {
            bronze: { points: 0, discount: 0 },
            silver: { points: 100, discount: 5 },
            gold: { points: 500, discount: 10 }
          },
          status: 'active'
        }
      ];
      res.json(programs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get loyalty programs' });
    }
  },

  async getLoyaltyProgram(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const program = {
        id: 'loyalty_001',
        name: 'برنامج الولاء',
        description: 'اكسب نقاط مع كل حجزء',
        pointsPerCurrency: 1,
        tierBenefits: {
          bronze: { points: 0, discount: 0 },
          silver: { points: 100, discount: 5 },
          gold: { points: 500, discount: 10 }
        },
        status: 'active'
      };
      res.json(program);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get loyalty program' });
    }
  },

  async updateLoyaltyProgram(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updatedProgram = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      res.json(updatedProgram);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update loyalty program' });
    }
  },

  // User loyalty points
  async getUserLoyaltyPoints(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const userPoints = {
        userId,
        totalPoints: 250,
        tier: 'silver',
        pointsHistory: [
          {
            id: 'points_001',
            points: 100,
            type: 'earned',
            description: 'حجزء',
            createdAt: '2024-01-15T10:30:00Z'
          },
          {
            id: 'points_002',
            points: 50,
            type: 'earned',
            description: 'حجزء فضي',
            createdAt: '2024-01-10T14:20:00Z'
          }
        ]
      };
      res.json(userPoints);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user loyalty points' });
    }
  },

  async addLoyaltyPoints(req: Request, res: Response) {
    try {
      const { userId, points, reason } = req.body;
      const addedPoints = {
        userId,
        points,
        reason,
        type: 'earned',
        createdAt: new Date().toISOString()
      };
      res.status(201).json(addedPoints);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add loyalty points' });
    }
  },

  // Discount analytics
  async getDiscountAnalytics(req: Request, res: Response) {
    try {
      const analytics = {
        totalCampaigns: 25,
        activeCampaigns: 8,
        totalCodes: 150,
        activeCodes: 120,
        totalRedemption: 450,
        averageDiscount: 12.5,
        totalSavings: 5600,
        loyaltyPrograms: 3,
        activeUsers: 1250
      };
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get discount analytics' });
    }
  }
};
