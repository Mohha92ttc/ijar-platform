import { query } from '../../database/connection';
import { NotificationService } from '../../services/notification.service';

export interface DiscountCampaign {
  id: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_delivery' | 'bundle' | 'loyalty';
  status: 'active' | 'inactive' | 'expired' | 'scheduled';
  discountValue: number;
  currency?: string;
  conditions: DiscountConditions;
  targeting: DiscountTargeting;
  schedule: DiscountSchedule;
  usage: {
    totalUsage: number;
    maxUsage?: number;
    usagePerUser?: number;
  };
  createdAt: Date;
  createdBy: string;
}

export interface DiscountConditions {
  minBookingValue?: number;
  maxDiscountAmount?: number;
  applicableCategories?: string[];
  applicableEquipment?: string[];
  applicablePartners?: string[];
  userSegments?: string[];
  bookingDuration?: {
    minDays?: number;
    maxDays?: number;
  };
  locationRestrictions?: string[];
  firstTimeUsersOnly?: boolean;
  loyaltyTierRequired?: string;
}

export interface DiscountTargeting {
  users: string[]; // معرفات المستخدمين المستهدفين
  segments: string[]; // شرائح المستخدمين
  locations: string[]; // المواقع الجغرافية
  categories: string[]; // فئات المعدات
  partners: string[]; // الشركاء
  excludeUsers: string[]; // مستخدمين مستبعدين
}

export interface DiscountSchedule {
  startDate: Date;
  endDate: Date;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    daysOfMonth?: number[]; // 1-31
  };
  activeHours?: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
}

export interface DiscountCode {
  id: string;
  campaignId: string;
  code: string;
  type: 'public' | 'private' | 'single_use';
  status: 'active' | 'inactive' | 'expired' | 'used';
  usageCount: number;
  maxUsage?: number;
  userId?: string; // للقسائم الخاصة
  expiresAt?: Date;
  createdAt: Date;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  tiers: LoyaltyTier[];
  points: {
    earnRate: number; // نقاط لكل 1000 د.ع
    redeemRate: number; // قيمة النقطة بالدينار
    expiryDays: number; // أيام انتهاء صلاحية النقاط
  };
  benefits: LoyaltyBenefit[];
  createdAt: Date;
  createdBy: string;
}

export interface LoyaltyTier {
  name: string;
  level: number;
  minPoints: number;
  benefits: string[];
  discountPercentage: number;
  freeDelivery: boolean;
  prioritySupport: boolean;
  exclusiveOffers: boolean;
}

export interface LoyaltyBenefit {
  type: 'discount' | 'free_delivery' | 'priority_support' | 'exclusive_offer' | 'bonus_points';
  value: number;
  description: string;
  tierRequired: number;
}

export interface UserPoints {
  userId: string;
  totalPoints: number;
  availablePoints: number;
  expiredPoints: number;
  tier: string;
  tierProgress: number;
  lastActivity: Date;
}

export class DiscountService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async createDiscountCampaign(campaignData: Partial<DiscountCampaign>): Promise<DiscountCampaign> {
    const sql = `
      INSERT INTO discount_campaigns (
        name, description, type, status, discount_value, currency,
        conditions, targeting, schedule, usage, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await query(sql, [
      campaignData.name,
      campaignData.description,
      campaignData.type,
      campaignData.status || 'active',
      campaignData.discountValue,
      campaignData.currency,
      JSON.stringify(campaignData.conditions),
      JSON.stringify(campaignData.targeting),
      JSON.stringify(campaignData.schedule),
      JSON.stringify(campaignData.usage || { totalUsage: 0 }),
      new Date(),
      campaignData.createdBy
    ]);

    return this.mapRowToCampaign(result.rows[0]);
  }

  async generateDiscountCode(campaignId: string, type: 'public' | 'private' | 'single_use' = 'public', userId?: string): Promise<DiscountCode> {
    const code = this.generateUniqueCode();
    
    const sql = `
      INSERT INTO discount_codes (
        campaign_id, code, type, status, usage_count, user_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query(sql, [
      campaignId,
      code,
      type,
      'active',
      0,
      userId,
      new Date()
    ]);

    return this.mapRowToCode(result.rows[0]);
  }

  async validateDiscountCode(code: string, userId: string, bookingData: any): Promise<{ valid: boolean; discount?: number; campaign?: DiscountCampaign }> {
    const result = await query(`
      SELECT dc.*, dcp.* 
      FROM discount_codes dc
      JOIN discount_campaigns dcp ON dc.campaign_id = dcp.id
      WHERE dc.code = $1 AND dc.status = 'active' AND dcp.status = 'active'
    `, [code]);

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const discountCode = this.mapRowToCode(result.rows[0]);
    const campaign = this.mapRowToCampaign(result.rows[0]);

    // التحقق من انتهاء الصلاحية
    if (discountCode.expiresAt && new Date() > discountCode.expiresAt) {
      return { valid: false };
    }

    if (new Date() < campaign.schedule.startDate || new Date() > campaign.schedule.endDate) {
      return { valid: false };
    }

    // التحقق من الحد الأقصى للاستخدام
    if (discountCode.maxUsage && discountCode.usageCount >= discountCode.maxUsage) {
      return { valid: false };
    }

    // التحقق من الاستخدام الفردي
    if (discountCode.type === 'single_use' && discountCode.usageCount > 0) {
      return { valid: false };
    }

    // التحقق من المستخدم للقسائم الخاصة
    if (discountCode.type === 'private' && discountCode.userId !== userId) {
      return { valid: false };
    }

    // التحقق من شروط الحملة
    const conditionsMet = await this.validateConditions(campaign.conditions, bookingData, userId);
    if (!conditionsMet.valid) {
      return { valid: false };
    }

    // حساب الخصم
    const discount = await this.calculateDiscount(campaign, bookingData);

    return { valid: true, discount, campaign };
  }

  async applyDiscount(codeId: string, userId: string, bookingId: string): Promise<void> {
    // تحديث استخدام الكود
    await query(
      'UPDATE discount_codes SET usage_count = usage_count + 1 WHERE id = $1',
      [codeId]
    );

    // تحديث استخدام الحملة
    await query(`
      UPDATE discount_campaigns 
      SET usage = jsonb_set(usage, '{totalUsage}', (COALESCE((usage->>'totalUsage')::int, 0) + 1)::text)
      WHERE id = (SELECT campaign_id FROM discount_codes WHERE id = $1)
    `, [codeId]);

    // تسجيل الاستخدام
    await query(`
      INSERT INTO discount_usage (code_id, user_id, booking_id, used_at)
      VALUES ($1, $2, $3, $4)
    `, [codeId, userId, bookingId, new Date()]);
  }

  async createLoyaltyProgram(programData: Partial<LoyaltyProgram>): Promise<LoyaltyProgram> {
    const sql = `
      INSERT INTO loyalty_programs (
        name, description, status, tiers, points, benefits, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await query(sql, [
      programData.name,
      programData.description,
      programData.status || 'active',
      JSON.stringify(programData.tiers),
      JSON.stringify(programData.points),
      JSON.stringify(programData.benefits),
      new Date(),
      programData.createdBy
    ]);

    return this.mapRowToProgram(result.rows[0]);
  }

  async earnPoints(userId: string, bookingId: string, points: number, reason: string): Promise<void> {
    // الحصول على نقاط المستخدم الحالية
    const userPoints = await this.getUserPoints(userId);

    // إضافة النقاط الجديدة
    const newTotalPoints = userPoints.totalPoints + points;
    const newAvailablePoints = userPoints.availablePoints + points;

    // تحديث نقاط المستخدم
    await query(`
      INSERT INTO user_points (user_id, total_points, available_points, tier, tier_progress, last_activity)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        total_points = $2,
        available_points = $3,
        tier = $4,
        tier_progress = $5,
        last_activity = $6
    `, [userId, newTotalPoints, newAvailablePoints, userPoints.tier, userPoints.tierProgress, new Date()]);

    // تسجيل كسب النقاط
    await query(`
      INSERT INTO point_transactions (user_id, booking_id, points, transaction_type, reason, created_at)
      VALUES ($1, $2, $3, 'earn', $4, $5)
    `, [userId, bookingId, points, reason, new Date()]);

    // التحقق من ترقية المستوى
    await this.checkTierUpgrade(userId);
  }

  async redeemPoints(userId: string, points: number, reason: string): Promise<boolean> {
    const userPoints = await this.getUserPoints(userId);

    if (userPoints.availablePoints < points) {
      return false;
    }

    // خصم النقاط
    const newAvailablePoints = userPoints.availablePoints - points;

    await query(`
      UPDATE user_points 
      SET available_points = $1, last_activity = $2
      WHERE user_id = $3
    `, [newAvailablePoints, new Date(), userId]);

    // تسجيل استخدام النقاط
    await query(`
      INSERT INTO point_transactions (user_id, points, transaction_type, reason, created_at)
      VALUES ($1, $2, 'redeem', $3, $4)
    `, [userId, points, reason, new Date()]);

    return true;
  }

  async getUserLoyaltyStatus(userId: string): Promise<UserPoints> {
    return await this.getUserPoints(userId);
  }

  async getActiveCampaigns(userId?: string): Promise<DiscountCampaign[]> {
    let sql = `
      SELECT * FROM discount_campaigns 
      WHERE status = 'active' 
      AND schedule.start_date <= CURRENT_TIMESTAMP 
      AND schedule.end_date >= CURRENT_TIMESTAMP
    `;
    const params = [];

    if (userId) {
      sql += ` AND (
        targeting->'users' @> $1::jsonb 
        OR cardinality(targeting->'users') = 0
      )`;
      params.push(JSON.stringify([userId]));
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows.map(row => this.mapRowToCampaign(row));
  }

  async getLoyaltyPrograms(): Promise<LoyaltyProgram[]> {
    const result = await query('SELECT * FROM loyalty_programs WHERE status = $1 ORDER BY created_at DESC', ['active']);
    return result.rows.map(row => this.mapRowToProgram(row));
  }

  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async validateConditions(conditions: DiscountConditions, bookingData: any, userId: string): Promise<{ valid: boolean; reason?: string }> {
    // التحقق من الحد الأدنى لقيمة الحجز
    if (conditions.minBookingValue && bookingData.totalAmount < conditions.minBookingValue) {
      return { valid: false, reason: 'قيمة الحجز أقل من الحد الأدنى المطلوب' };
    }

    // التحقق من فئات المعدات
    if (conditions.applicableCategories && conditions.applicableCategories.length > 0) {
      const equipmentCategory = await this.getEquipmentCategory(bookingData.equipmentId);
      if (!conditions.applicableCategories.includes(equipmentCategory)) {
        return { valid: false, reason: 'هذه الفئة غير مشمولة في الخصم' };
      }
    }

    // التحقق من المدة
    if (conditions.bookingDuration) {
      const duration = this.calculateBookingDuration(bookingData.startDate, bookingData.endDate);
      if (conditions.bookingDuration.minDays && duration < conditions.bookingDuration.minDays) {
        return { valid: false, reason: 'مدة الحجز أقل من الحد الأدنى المطلوب' };
      }
      if (conditions.bookingDuration.maxDays && duration > conditions.bookingDuration.maxDays) {
        return { valid: false, reason: 'مدة الحجز تتجاوز الحد الأقصى المسموح' };
      }
    }

    // التحقق من المستخدمين الجدد
    if (conditions.firstTimeUsersOnly) {
      const isExistingUser = await this.checkExistingUser(userId);
      if (isExistingUser) {
        return { valid: false, reason: 'هذا الخصم للمستخدمين الجدد فقط' };
      }
    }

    return { valid: true };
  }

  private async calculateDiscount(campaign: DiscountCampaign, bookingData: any): Promise<number> {
    let discount = 0;

    switch (campaign.type) {
      case 'percentage':
        discount = bookingData.totalAmount * (campaign.discountValue / 100);
        if (campaign.conditions.maxDiscountAmount) {
          discount = Math.min(discount, campaign.conditions.maxDiscountAmount);
        }
        break;
      case 'fixed_amount':
        discount = campaign.discountValue;
        break;
      case 'free_delivery':
        discount = await this.getDeliveryCost(bookingData);
        break;
      case 'bundle':
        discount = await this.calculateBundleDiscount(campaign, bookingData);
        break;
      case 'loyalty':
        discount = await this.calculateLoyaltyDiscount(campaign, bookingData);
        break;
    }

    return discount;
  }

  private async checkTierUpgrade(userId: string): Promise<void> {
    const userPoints = await this.getUserPoints(userId);
    const programs = await this.getLoyaltyPrograms();

    for (const program of programs) {
      const newTier = program.tiers
        .filter(tier => tier.minPoints <= userPoints.totalPoints)
        .sort((a, b) => b.level - a.level)[0];

      if (newTier.name !== userPoints.tier) {
        // ترقية المستوى
        await query(`
          UPDATE user_points 
          SET tier = $1, tier_progress = $2
          WHERE user_id = $3
        `, [newTier.name, userPoints.totalPoints, userId]);

        // إرسال إشعار الترقية
        await this.notificationService.sendNotification({
          userId,
          type: 'system',
          title: 'تهانينا! تم ترقية مستواك',
          message: `وصلت الآن إلى مستوى ${newTier.name} استمتع بالمزايا الجديدة!`,
          data: { newTier: newTier.name }
        });
      }
    }
  }

  private async getUserPoints(userId: string): Promise<UserPoints> {
    const result = await query('SELECT * FROM user_points WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      // إنشاء سجل نقاط جديد
      await query(`
        INSERT INTO user_points (user_id, total_points, available_points, tier, tier_progress, last_activity)
        VALUES ($1, 0, 0, 'bronze', 0, $2)
      `, [userId, new Date()]);

      return {
        userId,
        totalPoints: 0,
        availablePoints: 0,
        expiredPoints: 0,
        tier: 'bronze',
        tierProgress: 0,
        lastActivity: new Date()
      };
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      totalPoints: row.total_points,
      availablePoints: row.available_points,
      expiredPoints: row.expired_points,
      tier: row.tier,
      tierProgress: row.tier_progress,
      lastActivity: row.last_activity
    };
  }

  private async getEquipmentCategory(equipmentId: string): Promise<string> {
    const result = await query('SELECT category FROM equipment WHERE id = $1', [equipmentId]);
    return result.rows[0]?.category || '';
  }

  private calculateBookingDuration(startDate: Date, endDate: Date): number {
    return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  }

  private async checkExistingUser(userId: string): Promise<boolean> {
    const result = await query('SELECT COUNT(*) as count FROM bookings WHERE customer_id = $1', [userId]);
    return parseInt(result.rows[0].count) > 0;
  }

  private async getDeliveryCost(bookingData: any): Promise<number> {
    // منطق حساب تكلفة التوصيل
    return 10000; // 10,000 د.ع كتكلفة توصيل افتراضية
  }

  private async calculateBundleDiscount(campaign: DiscountCampaign, bookingData: any): Promise<number> {
    // منطق حساب خصم الحزمة
    return campaign.discountValue;
  }

  private async calculateLoyaltyDiscount(campaign: DiscountCampaign, bookingData: any): Promise<number> {
    // منطق حساب خصم الولاء
    return campaign.discountValue;
  }

  private mapRowToCampaign(row: any): DiscountCampaign {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      discountValue: row.discount_value,
      currency: row.currency,
      conditions: row.conditions,
      targeting: row.targeting,
      schedule: row.schedule,
      usage: row.usage,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }

  private mapRowToCode(row: any): DiscountCode {
    return {
      id: row.id,
      campaignId: row.campaign_id,
      code: row.code,
      type: row.type,
      status: row.status,
      usageCount: row.usage_count,
      maxUsage: row.max_usage,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  private mapRowToProgram(row: any): LoyaltyProgram {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      tiers: row.tiers,
      points: row.points,
      benefits: row.benefits,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }
}

export default new DiscountService();
