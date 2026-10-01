import { query } from '../../database/connection';
import { NotificationService } from '../../services/notification.service';

export interface InsurancePolicy {
  id: string;
  equipmentId: string;
  ownerId: string;
  customerId: string;
  type: 'basic' | 'premium' | 'comprehensive';
  coverage: {
    damage: number; // نسبة التغطية
    theft: number;
    liability: number;
    delay: number;
  };
  premium: number;
  deductible: number;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expired' | 'claimed' | 'cancelled';
  terms: string[];
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  claimType: 'damage' | 'theft' | 'delay' | 'liability';
  description: string;
  evidence: string[]; // صور أو فيديو
  estimatedCost: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  submittedAt: Date;
  processedAt?: Date;
  processedBy?: string;
  settlementAmount?: number;
}

export class InsuranceService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async createInsurancePolicy(policyData: Partial<InsurancePolicy>): Promise<InsurancePolicy> {
    const sql = `
      INSERT INTO insurance_policies (
        equipment_id, owner_id, customer_id, type, coverage, premium, 
        deductible, start_date, end_date, status, terms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await query(sql, [
      policyData.equipmentId,
      policyData.ownerId,
      policyData.customerId,
      policyData.type,
      JSON.stringify(policyData.coverage),
      policyData.premium,
      policyData.deductible,
      policyData.startDate,
      policyData.endDate,
      'active',
      JSON.stringify(policyData.terms || [])
    ]);

    const policy = this.mapRowToPolicy(result.rows[0]);

    // إرسال إشعار بإنشاء بوليصة التأمين
    if (policyData.customerId) {
      await this.notificationService.sendNotification({
        userId: policyData.customerId,
        type: 'system',
        title: 'تم إنشاء بوليصة تأمين',
        message: `تم إنشاء بوليصة تأمين للمعدات ${policyData.equipmentId} بنجاح`,
        data: { policyId: policy.id }
      });
    }

    return policy;
  }

  async submitClaim(claimData: Partial<InsuranceClaim>): Promise<InsuranceClaim> {
    const sql = `
      INSERT INTO insurance_claims (
        policy_id, claim_type, description, evidence, estimated_cost, 
        status, submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query(sql, [
      claimData.policyId,
      claimData.claimType,
      claimData.description,
      JSON.stringify(claimData.evidence || []),
      claimData.estimatedCost,
      'pending',
      new Date()
    ]);

    const claim = this.mapRowToClaim(result.rows[0]);

    // إرسال إشعار بتقديم مطالبة
    await this.sendClaimNotifications(claim);

    return claim;
  }

  async processClaim(claimId: string, status: 'approved' | 'rejected', settlementAmount?: number, processedBy?: string): Promise<InsuranceClaim> {
    const sql = `
      UPDATE insurance_claims 
      SET status = $1, processed_at = $2, processed_by = $3, settlement_amount = $4
      WHERE id = $5
      RETURNING *
    `;

    const result = await query(sql, [status, new Date(), processedBy, settlementAmount, claimId]);
    const claim = this.mapRowToClaim(result.rows[0]);

    // إرسال إشعار بمعالجة المطالبة
    await this.sendClaimProcessedNotifications(claim);

    return claim;
  }

  async getActivePolicies(userId: string): Promise<InsurancePolicy[]> {
    const sql = `
      SELECT * FROM insurance_policies 
      WHERE (owner_id = $1 OR customer_id = $1) 
      AND status = 'active' 
      AND end_date > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;

    const result = await query(sql, [userId]);
    return result.rows.map(row => this.mapRowToPolicy(row));
  }

  async getPolicyClaims(policyId: string): Promise<InsuranceClaim[]> {
    const sql = `
      SELECT * FROM insurance_claims 
      WHERE policy_id = $1 
      ORDER BY submitted_at DESC
    `;

    const result = await query(sql, [policyId]);
    return result.rows.map(row => this.mapRowToClaim(row));
  }

  async calculatePremium(equipmentId: string, type: 'basic' | 'premium' | 'comprehensive', duration: number): Promise<number> {
    // الحصول على معلومات المعدات
    const equipmentResult = await query('SELECT price_per_day, category FROM equipment WHERE id = $1', [equipmentId]);
    const equipment = equipmentResult.rows[0];

    if (!equipment) {
      throw new Error('المعدات غير موجودة');
    }

    const baseRate = this.getBaseRate(equipment.category);
    const equipmentValue = equipment.price_per_day * 30; // قيمة المعدات التقديرية
    const riskFactor = await this.calculateRiskFactor(equipmentId);

    let premium = 0;

    switch (type) {
      case 'basic':
        premium = (equipmentValue * 0.02 * riskFactor) + (baseRate * duration);
        break;
      case 'premium':
        premium = (equipmentValue * 0.035 * riskFactor) + (baseRate * 1.5 * duration);
        break;
      case 'comprehensive':
        premium = (equipmentValue * 0.05 * riskFactor) + (baseRate * 2 * duration);
        break;
    }

    return Math.round(premium);
  }

  async validateClaim(claimId: string): Promise<{ valid: boolean; reasons: string[] }> {
    const claim = await this.getClaim(claimId);
    const policy = await this.getPolicy(claim.policyId);

    const reasons: string[] = [];
    let valid = true;

    // التحقق من صلاحية البوليصة
    if (policy.status !== 'active') {
      reasons.push('البوليصة غير نشطة');
      valid = false;
    }

    // التحقق من تاريخ البوليصة
    if (new Date() < policy.startDate || new Date() > policy.endDate) {
      reasons.push('المطالبة خارج فترة التغطية');
      valid = false;
    }

    // التحقق من نوع التغطية
    const coverage = policy.coverage;
    if (claim.claimType === 'damage' && coverage.damage < 50) {
      reasons.push('التغطية لأضرار المعدات غير كافية');
      valid = false;
    }

    // التحقق من الأدلة
    if (!claim.evidence || claim.evidence.length === 0) {
      reasons.push('لا يوجد أدلة كافية');
      valid = false;
    }

    return { valid, reasons };
  }

  private async sendClaimNotifications(claim: InsuranceClaim): Promise<void> {
    const policy = await this.getPolicy(claim.policyId);

    // إشعار للعميل
    await this.notificationService.sendNotification({
      userId: policy.customerId,
      type: 'system',
      title: 'تم تقديم مطالبة تأمين',
      message: `تم تقديم مطالبتك بنجاح. سيتم مراجعتها خلال 24-48 ساعة`,
      data: { claimId: claim.id }
    });

    // إشعار للشريك
    await this.notificationService.sendNotification({
      userId: policy.ownerId,
      type: 'system',
      title: 'مطالبة تأمين جديدة',
      message: `تم تقديم مطالبة تأمين على معداتك`,
      data: { claimId: claim.id }
    });
  }

  private async sendClaimProcessedNotifications(claim: InsuranceClaim): Promise<void> {
    const policy = await this.getPolicy(claim.policyId);

    const title = claim.status === 'approved' ? 'تمت الموافقة على مطالبتك' : 'تم رفض مطالبتك';
    const message = claim.status === 'approved' 
      ? `تمت الموافقة على مطالبتك بمبلغ ${claim.settlementAmount} د.ع`
      : 'نأسف، تم رفض مطالبتك. سيتم إرسال التفاصيل قريباً';

    // إشعار للعميل
    await this.notificationService.sendNotification({
      userId: policy.customerId,
      type: 'system',
      title,
      message,
      data: { claimId: claim.id, status: claim.status }
    });
  }

  private async getClaim(claimId: string): Promise<InsuranceClaim> {
    const result = await query('SELECT * FROM insurance_claims WHERE id = $1', [claimId]);
    return this.mapRowToClaim(result.rows[0]);
  }

  private async getPolicy(policyId: string): Promise<InsurancePolicy> {
    const result = await query('SELECT * FROM insurance_policies WHERE id = $1', [policyId]);
    return this.mapRowToPolicy(result.rows[0]);
  }

  private getBaseRate(category: string): number {
    const rates: Record<string, number> = {
      'معدات بناء': 50000,
      'مولدات': 30000,
      'معدات ثقيلة': 80000,
      'أدوات يدوية': 10000,
      'تصوير': 40000,
      'صوتيات': 35000
    };

    return rates[category] || 25000;
  }

  private async calculateRiskFactor(equipmentId: string): Promise<number> {
    // حساب عامل الخطر بناءً على:
    // 1. تاريخ المعدات
    // 2. عدد مرات الاستخدام
    // 3. تقييمات العملاء
    // 4. تاريخ المطالبات السابقة

    const equipmentResult = await query(`
      SELECT e.created_at, e.review_count, e.average_rating,
             COUNT(ic.id) as claim_count
      FROM equipment e
      LEFT JOIN insurance_claims ic ON ic.policy_id IN (
        SELECT id FROM insurance_policies WHERE equipment_id = e.id
      )
      WHERE e.id = $1
      GROUP BY e.id, e.created_at, e.review_count, e.average_rating
    `, [equipmentId]);

    const equipment = equipmentResult.rows[0];
    
    let riskFactor = 1.0;

    // عامل العمر
    const ageInMonths = (new Date().getTime() - new Date(equipment.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (ageInMonths > 24) riskFactor += 0.2;
    if (ageInMonths > 48) riskFactor += 0.3;

    // عامل التقييم
    if (equipment.average_rating < 3.5) riskFactor += 0.3;
    if (equipment.average_rating < 2.5) riskFactor += 0.5;

    // عامل المطالبات
    if (equipment.claim_count > 2) riskFactor += 0.4;
    if (equipment.claim_count > 5) riskFactor += 0.8;

    return Math.min(riskFactor, 2.5); // الحد الأقصى 2.5
  }

  private mapRowToPolicy(row: any): InsurancePolicy {
    return {
      id: row.id,
      equipmentId: row.equipment_id,
      ownerId: row.owner_id,
      customerId: row.customer_id,
      type: row.type,
      coverage: row.coverage,
      premium: row.premium,
      deductible: row.deductible,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      terms: row.terms
    };
  }

  private mapRowToClaim(row: any): InsuranceClaim {
    return {
      id: row.id,
      policyId: row.policy_id,
      claimType: row.claim_type,
      description: row.description,
      evidence: row.evidence,
      estimatedCost: row.estimated_cost,
      status: row.status,
      submittedAt: row.submitted_at,
      processedAt: row.processed_at,
      processedBy: row.processed_by,
      settlementAmount: row.settlement_amount
    };
  }
}

export default new InsuranceService();
