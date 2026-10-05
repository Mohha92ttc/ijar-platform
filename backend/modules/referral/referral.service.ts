import { query } from '../../database/connection';
import { NotificationService } from '../../services/notification.service';

export interface ReferralProgram {
  id: string;
  name: string;
  description: string;
  type: 'customer' | 'partner' | 'both';
  status: 'active' | 'inactive' | 'expired';
  rewards: {
    referrer: {
      type: 'cash' | 'credit' | 'discount';
      amount: number;
      currency: string;
      conditions: string[];
    };
    referee: {
      type: 'discount' | 'credit' | 'free_service';
      amount: number;
      currency: string;
      duration?: number; // بالأيام
    };
  };
  conditions: {
    minBookingValue?: number;
    requiredActions: string[];
    expiryDays?: number;
    maxReferrals?: number;
  };
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface ReferralCode {
  id: string;
  userId: string;
  programId: string;
  code: string;
  status: 'active' | 'inactive' | 'expired';
  usageCount: number;
  maxUsage?: number;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ReferralTransaction {
  id: string;
  referralCodeId: string;
  referrerId: string;
  refereeId: string;
  programId: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  triggerEvent: string;
  triggerData: any;
  rewards: {
    referrerReward: Reward;
    refereeReward: Reward;
  };
  completedAt?: Date;
  processedAt?: Date;
  createdAt: Date;
}

export interface Reward {
  type: 'cash' | 'credit' | 'discount' | 'free_service';
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'issued' | 'used' | 'expired';
  issuedAt?: Date;
  expiresAt?: Date;
  usedAt?: Date;
}

export interface RecommendationEngine {
  userId: string;
  recommendations: Recommendation[];
  generatedAt: Date;
  algorithm: string;
  confidence: number;
}

export interface Recommendation {
  type: 'equipment' | 'partner' | 'service' | 'promotion';
  itemId: string;
  title: string;
  description: string;
  score: number;
  reasons: string[];
  imageUrl?: string;
  price?: number;
  location?: string;
  rating?: number;
}

export class ReferralService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async createReferralProgram(programData: Partial<ReferralProgram>): Promise<ReferralProgram> {
    const sql = `
      INSERT INTO referral_programs (
        name, description, type, status, rewards, conditions,
        start_date, end_date, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await query(sql, [
      programData.name,
      programData.description,
      programData.type,
      programData.status || 'active',
      JSON.stringify(programData.rewards),
      JSON.stringify(programData.conditions),
      programData.startDate,
      programData.endDate,
      new Date(),
      programData.createdBy
    ]);

    return this.mapRowToProgram(result.rows[0]);
  }

  async generateReferralCode(userId: string, programId: string): Promise<ReferralCode> {
    const code = this.generateUniqueCode();
    
    const sql = `
      INSERT INTO referral_codes (
        user_id, program_id, code, status, created_at
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await query(sql, [userId, programId, code, 'active', new Date()]);
    return this.mapRowToCode(result.rows[0]);
  }

  async validateReferralCode(code: string, refereeId: string): Promise<{ valid: boolean; program?: ReferralProgram; referralCode?: ReferralCode }> {
    const result = await query(`
      SELECT rc.*, rp.* 
      FROM referral_codes rc
      JOIN referral_programs rp ON rc.program_id = rp.id
      WHERE rc.code = $1 AND rc.status = 'active' AND rp.status = 'active'
    `, [code]);

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const referralCode = this.mapRowToCode(result.rows[0]);
    const program = this.mapRowToProgram(result.rows[0]);

    // التحقق من انتهاء الصلاحية
    if (referralCode.expiresAt && new Date() > referralCode.expiresAt) {
      return { valid: false };
    }

    if (program.endDate && new Date() > program.endDate) {
      return { valid: false };
    }

    // التحقق من الحد الأقصى للاستخدام
    if (referralCode.maxUsage && referralCode.usageCount >= referralCode.maxUsage) {
      return { valid: false };
    }

    // التحقق من أن المستخدم لا يحيل نفسه
    if (referralCode.userId === refereeId) {
      return { valid: false };
    }

    return { valid: true, program, referralCode };
  }

  async processReferral(referralCodeId: string, refereeId: string, triggerEvent: string, triggerData: any): Promise<ReferralTransaction> {
    const referralCode = await this.getReferralCode(referralCodeId);
    const program = await this.getProgram(referralCode.programId);

    // إنشاء معاملة الإحالة
    const transaction: ReferralTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      referralCodeId,
      referrerId: referralCode.userId,
      refereeId,
      programId: program.id,
      status: 'pending',
      triggerEvent,
      triggerData,
      rewards: {
        referrerReward: await this.createReward(program.rewards.referrer, referralCode.userId),
        refereeReward: await this.createReward(program.rewards.referee, refereeId)
      },
      createdAt: new Date()
    };

    // حفظ المعاملة
    await this.saveTransaction(transaction);

    // تحديث استخدام الكود
    await query(
      'UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = $1',
      [referralCodeId]
    );

    // إرسال إشعارات
    await this.sendReferralNotifications(transaction);

    return transaction;
  }

  async completeReferral(transactionId: string): Promise<ReferralTransaction> {
    const transaction = await this.getTransaction(transactionId);

    // تحديث حالة المكافآت
    await this.issueReward(transaction.rewards.referrerReward);
    await this.issueReward(transaction.rewards.refereeReward);

    // تحديث المعاملة
    await query(`
      UPDATE referral_transactions 
      SET status = 'completed', completed_at = $1, processed_at = $1
      WHERE id = $2
    `, [new Date(), transactionId]);

    // إرسال إشعارات الإتمام
    await this.sendCompletionNotifications(transaction);

    return await this.getTransaction(transactionId);
  }

  async generateRecommendations(userId: string, count: number = 10): Promise<RecommendationEngine> {
    // تحليل سلوك المستخدم
    const userBehavior = await this.analyzeUserBehavior(userId);
    
    // الحصول على التوصيات
    const recommendations = await this.generatePersonalizedRecommendations(userBehavior, count);

    const engine: RecommendationEngine = {
      userId,
      recommendations,
      generatedAt: new Date(),
      algorithm: 'hybrid_collaborative_content',
      confidence: this.calculateConfidence(recommendations)
    };

    // حفظ التوصيات
    await this.saveRecommendations(engine);

    return engine;
  }

  async getReferralStats(userId: string): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN rt.status = 'completed' THEN 1 END) as completed_referrals,
        SUM(CASE WHEN rt.status = 'completed' THEN 1 ELSE 0 END) as total_rewards,
        COALESCE(SUM(CASE WHEN rt.status = 'completed' THEN 
          (rt.rewards->'referrerReward'->>'amount')::numeric 
        END), 0) as total_earned
      FROM referral_transactions rt
      WHERE rt.referrer_id = $1
    `;

    const result = await query(sql, [userId]);
    return result.rows[0];
  }

  async getActivePrograms(type?: 'customer' | 'partner' | 'both'): Promise<ReferralProgram[]> {
    let sql = 'SELECT * FROM referral_programs WHERE status = $1';
    const params = ['active'];

    if (type && type !== 'both') {
      sql += ' AND type = $2';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
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

  private async analyzeUserBehavior(userId: string): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_bookings,
        AVG(b.total_amount) as avg_booking_value,
        array_agg(DISTINCT e.category) as preferred_categories,
        array_agg(DISTINCT e.location) as preferred_locations,
        COUNT(CASE WHEN b.rating >= 4 THEN 1 END) as positive_reviews
      FROM bookings b
      JOIN equipment e ON b.equipment_id = e.id
      WHERE b.customer_id = $1
      AND b.created_at > CURRENT_DATE - INTERVAL '90 days'
    `;

    const result = await query(sql, [userId]);
    return result.rows[0];
  }

  private async generatePersonalizedRecommendations(behavior: any, count: number): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // توصيات المعدات بناءً على الفئات المفضلة
    if (behavior.preferred_categories && behavior.preferred_categories.length > 0) {
      const equipmentSql = `
        SELECT e.id, e.title, e.description, e.price_per_day, e.location, 
               e.average_rating, e.images[1] as image_url
        FROM equipment e
        WHERE e.category = ANY($1)
        AND e.status = 'available'
        AND e.average_rating >= 4
        ORDER BY e.average_rating DESC, e.review_count DESC
        LIMIT $2
      `;

      const equipmentResult = await query(equipmentSql, [behavior.preferred_categories, Math.floor(count / 2)]);
      
      equipmentResult.rows.forEach(equipment => {
        recommendations.push({
          type: 'equipment',
          itemId: equipment.id,
          title: equipment.title,
          description: equipment.description,
          score: equipment.average_rating / 5,
          reasons: ['مطابق لفئاتك المفضلة', 'تقييم عالي'],
          imageUrl: equipment.image_url,
          price: equipment.price_per_day,
          location: equipment.location,
          rating: equipment.average_rating
        });
      });
    }

    // توصيات الشركاء بناءً على التقييمات
    const partnerSql = `
      SELECT u.id, u.name, u.bio,
             AVG(e.average_rating) as avg_rating,
             COUNT(e.id) as equipment_count
      FROM users u
      JOIN equipment e ON u.id = e.owner_id
      WHERE u.role = 'owner' AND u.is_approved = true
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      AND e.average_rating >= 4
      GROUP BY u.id, u.name, u.bio
      HAVING COUNT(e.id) >= 3
      ORDER BY avg_rating DESC
      LIMIT $1
    `;

    const partnerResult = await query(partnerSql, [Math.ceil(count / 2)]);
    
    partnerResult.rows.forEach(partner => {
      recommendations.push({
        type: 'partner',
        itemId: partner.id,
        title: partner.name,
        description: partner.bio || `شريك موثوق مع ${partner.equipment_count} معدات`,
        score: partner.avg_rating / 5,
        reasons: ['شريك موثوق', 'تقييمات عالية'],
        rating: partner.avg_rating
      });
    });

    return recommendations.slice(0, count);
  }

  private calculateConfidence(recommendations: Recommendation[]): number {
    if (recommendations.length === 0) return 0;
    
    const avgScore = recommendations.reduce((sum, rec) => sum + rec.score, 0) / recommendations.length;
    return Math.round(avgScore * 100) / 100;
  }

  private async createReward(rewardConfig: any, userId: string): Promise<Reward> {
    return {
      type: rewardConfig.type,
      amount: rewardConfig.amount,
      currency: rewardConfig.currency,
      description: this.generateRewardDescription(rewardConfig),
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 يوم
    };
  }

  private generateRewardDescription(config: { type: 'cash' | 'credit' | 'discount' | 'free_service'; amount?: number; currency?: string }): string {
    const descriptions = {
      cash: `مكافأة نقدية ${config.amount} ${config.currency}`,
      credit: `رصيد ${config.amount} ${config.currency}`,
      discount: `خصم ${config.amount}% على الحجز التالي`,
      free_service: `خدمة مجانية`
    };
    return descriptions[config.type] || 'مكافأة خاصة';
  }

  private async issueReward(reward: Reward): Promise<void> {
    // تحديث حالة المكافأة
    await query(`
      INSERT INTO user_rewards (type, amount, currency, description, status, issued_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [reward.type, reward.amount, reward.currency, reward.description, 'issued', new Date(), reward.expiresAt]);
  }

  private async sendReferralNotifications(transaction: ReferralTransaction): Promise<void> {
    // إشعار للمحيل
    await this.notificationService.sendNotification({
      userId: transaction.referrerId,
      type: 'system',
      title: 'إحالة جديدة',
      message: 'قام شخص باستخدام كود الإحالة الخاص بك',
      data: { transactionId: transaction.id }
    });

    // إشعار للمحال
    await this.notificationService.sendNotification({
      userId: transaction.refereeId,
      type: 'system',
      title: 'مرحباً بك!',
      message: 'تم تطبيق خصم الإحالة بنجاح',
      data: { transactionId: transaction.id }
    });
  }

  private async sendCompletionNotifications(transaction: ReferralTransaction): Promise<void> {
    // إشعار للمحيل باستلام المكافأة
    await this.notificationService.sendNotification({
      userId: transaction.referrerId,
      type: 'system',
      title: 'مكافأة الإحالة',
      message: `تهانينا! حصلت على ${transaction.rewards.referrerReward.description}`,
      data: { transactionId: transaction.id, reward: transaction.rewards.referrerReward }
    });

    // إشعار للمحال باستلام المكافأة
    await this.notificationService.sendNotification({
      userId: transaction.refereeId,
      type: 'system',
      title: 'مكافأة الترحيب',
      message: `شكراً لانضمامك! حصلت على ${transaction.rewards.refereeReward.description}`,
      data: { transactionId: transaction.id, reward: transaction.rewards.refereeReward }
    });
  }

  private async saveTransaction(transaction: ReferralTransaction): Promise<void> {
    const sql = `
      INSERT INTO referral_transactions (
        id, referral_code_id, referrer_id, referee_id, program_id, status,
        trigger_event, trigger_data, rewards, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    await query(sql, [
      transaction.id,
      transaction.referralCodeId,
      transaction.referrerId,
      transaction.refereeId,
      transaction.programId,
      transaction.status,
      transaction.triggerEvent,
      JSON.stringify(transaction.triggerData),
      JSON.stringify(transaction.rewards),
      transaction.createdAt
    ]);
  }

  private async saveRecommendations(engine: RecommendationEngine): Promise<void> {
    const sql = `
      INSERT INTO user_recommendations (
        user_id, recommendations, generated_at, algorithm, confidence
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        recommendations = $2, generated_at = $3, algorithm = $4, confidence = $5
    `;

    await query(sql, [
      engine.userId,
      JSON.stringify(engine.recommendations),
      engine.generatedAt,
      engine.algorithm,
      engine.confidence
    ]);
  }

  private async getReferralCode(codeId: string): Promise<ReferralCode> {
    const result = await query('SELECT * FROM referral_codes WHERE id = $1', [codeId]);
    return this.mapRowToCode(result.rows[0]);
  }

  private async getProgram(programId: string): Promise<ReferralProgram> {
    const result = await query('SELECT * FROM referral_programs WHERE id = $1', [programId]);
    return this.mapRowToProgram(result.rows[0]);
  }

  private async getTransaction(transactionId: string): Promise<ReferralTransaction> {
    const result = await query('SELECT * FROM referral_transactions WHERE id = $1', [transactionId]);
    return this.mapRowToTransaction(result.rows[0]);
  }

  private mapRowToProgram(row: any): ReferralProgram {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      rewards: row.rewards,
      conditions: row.conditions,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      createdBy: row.created_by
    };
  }

  private mapRowToCode(row: any): ReferralCode {
    return {
      id: row.id,
      userId: row.user_id,
      programId: row.program_id,
      code: row.code,
      status: row.status,
      usageCount: row.usage_count,
      maxUsage: row.max_usage,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  private mapRowToTransaction(row: any): ReferralTransaction {
    return {
      id: row.id,
      referralCodeId: row.referral_code_id,
      referrerId: row.referrer_id,
      refereeId: row.referee_id,
      programId: row.program_id,
      status: row.status,
      triggerEvent: row.trigger_event,
      triggerData: row.trigger_data,
      rewards: row.rewards,
      completedAt: row.completed_at,
      processedAt: row.processed_at,
      createdAt: row.created_at
    };
  }
}

export default new ReferralService();
