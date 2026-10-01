import { query } from '../../database/connection';
import { NotificationService } from '../../services/notification.service';

export interface DigitalContract {
  id: string;
  bookingId: string;
  equipmentId: string;
  customerId: string;
  ownerId: string;
  type: 'rental' | 'service' | 'maintenance';
  status: 'draft' | 'pending_signature' | 'active' | 'completed' | 'cancelled';
  terms: ContractTerms;
  signatures: DigitalSignature[];
  createdAt: Date;
  updatedAt: Date;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  currency: 'IQD' | 'USD';
  specialConditions: string[];
  attachments: string[];
}

export interface ContractTerms {
  rentalPeriod: {
    startDate: Date;
    endDate: Date;
    duration: number; // بالأيام
  };
  payment: {
    totalAmount: number;
    currency: string;
    paymentMethod: string;
    paymentSchedule: PaymentSchedule[];
    depositAmount?: number;
    lateFees: {
      percentage: number;
      maxAmount: number;
    };
  };
  equipment: {
    description: string;
    condition: string;
    accessories: string[];
    maintenanceResponsibility: 'owner' | 'customer';
    insuranceRequirement: boolean;
  };
  responsibilities: {
    customer: string[];
    owner: string[];
  };
  termination: {
    noticePeriod: number; // بالأيام
    penalties: {
      earlyTermination: number;
      damage: number;
      lateReturn: number;
    };
  };
  disputeResolution: {
    method: 'mediation' | 'arbitration' | 'court';
    jurisdiction: string;
    language: string;
  };
}

export interface PaymentSchedule {
  dueDate: Date;
  amount: number;
  description: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: Date;
}

export interface DigitalSignature {
  id: string;
  contractId: string;
  signerId: string;
  signerType: 'customer' | 'owner' | 'witness';
  signatureData: string; // Base64 encoded signature
  ipAddress: string;
  userAgent: string;
  signedAt: Date;
  verified: boolean;
  verificationMethod: 'email' | 'sms' | 'id_document';
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: 'rental' | 'service' | 'maintenance';
  language: string;
  terms: ContractTerms;
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ContractService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async createContract(bookingId: string): Promise<DigitalContract> {
    // الحصول على معلومات الحجز
    const bookingResult = await query(`
      SELECT b.*, e.title as equipment_title, e.description as equipment_description,
             u1.name as customer_name, u1.email as customer_email, u1.phone as customer_phone,
             u2.name as owner_name, u2.email as owner_email, u2.phone as owner_phone
      FROM bookings b
      JOIN equipment e ON b.equipment_id = e.id
      JOIN users u1 ON b.customer_id = u1.id
      JOIN users u2 ON e.owner_id = u2.id
      WHERE b.id = $1
    `, [bookingId]);

    const booking = bookingResult.rows[0];
    if (!booking) {
      throw new Error('الحجز غير موجود');
    }

    // إنشاء شروط العقد
    const terms = await this.generateContractTerms(booking);

    // إنشاء العقد
    const sql = `
      INSERT INTO digital_contracts (
        booking_id, equipment_id, customer_id, owner_id, type, status,
        terms, created_at, updated_at, start_date, end_date, total_amount, currency,
        special_conditions, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const result = await query(sql, [
      bookingId,
      booking.equipment_id,
      booking.customer_id,
      booking.owner_id,
      'rental',
      'draft',
      JSON.stringify(terms),
      new Date(),
      new Date(),
      booking.start_date,
      booking.end_date,
      booking.total_amount,
      'IQD',
      [],
      []
    ]);

    const contract = this.mapRowToContract(result.rows[0]);

    // إرسال إشعارات
    await this.sendContractNotifications(contract);

    return contract;
  }

  async signContract(contractId: string, signerId: string, signerType: 'customer' | 'owner', signatureData: string, ipAddress: string, userAgent: string): Promise<DigitalContract> {
    // إضافة التوقيع الرقمي
    const signatureSql = `
      INSERT INTO digital_signatures (
        contract_id, signer_id, signer_type, signature_data, 
        ip_address, user_agent, signed_at, verified, verification_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    await query(signatureSql, [
      contractId,
      signerId,
      signerType,
      signatureData,
      ipAddress,
      userAgent,
      new Date(),
      false,
      'email'
    ]);

    // تحديث حالة العقد
    const contract = await this.getContract(contractId);
    const signatures = await this.getContractSignatures(contractId);

    let newStatus = contract.status;
    if (signatures.length === 1) {
      newStatus = 'pending_signature';
    } else if (signatures.length === 2) {
      newStatus = 'active';
    }

    await query(
      'UPDATE digital_contracts SET status = $1, updated_at = $2 WHERE id = $3',
      [newStatus, new Date(), contractId]
    );

    // التحقق من التوقيعات
    await this.verifySignature(signatures[signatures.length - 1].id);

    // إرسال إشعارات
    await this.sendSignatureNotifications(contractId, signerType);

    return await this.getContract(contractId);
  }

  async terminateContract(contractId: string, reason: string, terminatedBy: string): Promise<DigitalContract> {
    const contract = await this.getContract(contractId);
    
    // حساب الغرامات
    const penalties = await this.calculateTerminationPenalties(contract);
    
    // تحديث العقد
    await query(`
      UPDATE digital_contracts 
      SET status = 'cancelled', updated_at = $1 
      WHERE id = $2
    `, [new Date(), contractId]);

    // حفظ سجل الإنهاء
    await query(`
      INSERT INTO contract_terminations (contract_id, reason, terminated_by, penalties, terminated_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [contractId, reason, terminatedBy, JSON.stringify(penalties), new Date()]);

    // إرسال إشعارات
    await this.sendTerminationNotifications(contract, reason, penalties);

    return await this.getContract(contractId);
  }

  async generateContractPDF(contractId: string): Promise<Buffer> {
    const contract = await this.getContract(contractId);
    const signatures = await this.getContractSignatures(contractId);

    // هنا يتم إنشاء PDF باستخدام مكتبة مثل puppeteer
    // هذا مثال مبسط
    const pdfContent = `
      عقد الإيجار الرقمي - إيجار
      ========================================
      
      رقم العقد: ${contract.id}
      تاريخ العقد: ${contract.createdAt.toLocaleDateString('ar-IQ')}
      
      الطرف الأول (المالك): ${contract.ownerId}
      الطرف الثاني (المستأجر): ${contract.customerId}
      
      المعدات: ${contract.equipmentId}
      فترة الإيجار: ${contract.startDate.toLocaleDateString('ar-IQ')} - ${contract.endDate.toLocaleDateString('ar-IQ')}
      المبلغ الإجمالي: ${contract.totalAmount} ${contract.currency}
      
      الشروط والأحكام:
      ${JSON.stringify(contract.terms, null, 2)}
      
      التوقيعات:
      ${signatures.map(sig => `${sig.signerType}: ${sig.signedAt.toLocaleDateString('ar-IQ')}`).join('\n')}
    `;

    // في التطبيق الفعلي، استخدم مكتبة PDF
    return Buffer.from(pdfContent, 'utf-8');
  }

  async getContractTemplates(category?: string, language: string = 'ar'): Promise<ContractTemplate[]> {
    let sql = 'SELECT * FROM contract_templates WHERE language = $1 AND is_active = true';
    const params = [language];

    if (category) {
      sql += ' AND category = $2';
      params.push(category);
    }

    sql += ' ORDER BY usage_count DESC, name';

    const result = await query(sql, params);
    return result.rows.map(row => this.mapRowToTemplate(row));
  }

  async createContractTemplate(templateData: Partial<ContractTemplate>): Promise<ContractTemplate> {
    const sql = `
      INSERT INTO contract_templates (
        name, description, category, language, terms, is_active, 
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await query(sql, [
      templateData.name,
      templateData.description,
      templateData.category,
      templateData.language,
      JSON.stringify(templateData.terms),
      true,
      templateData.createdBy,
      new Date(),
      new Date()
    ]);

    return this.mapRowToTemplate(result.rows[0]);
  }

  private async generateContractTerms(booking: any): Promise<ContractTerms> {
    const duration = Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / (1000 * 60 * 60 * 24));

    return {
      rentalPeriod: {
        startDate: new Date(booking.start_date),
        endDate: new Date(booking.end_date),
        duration
      },
      payment: {
        totalAmount: Number(booking.total_amount),
        currency: 'IQD',
        paymentMethod: 'cash_on_delivery',
        paymentSchedule: [
          {
            dueDate: new Date(booking.start_date),
            amount: Number(booking.total_amount),
            description: 'دفع الإيجار',
            status: 'pending'
          }
        ],
        depositAmount: Number(booking.total_amount) * 0.2, // 20% تأمين
        lateFees: {
          percentage: 5, // 5% يومياً
          maxAmount: Number(booking.total_amount) * 0.5 // 50% كحد أقصى
        }
      },
      equipment: {
        description: booking.equipment_description,
        condition: 'جيد',
        accessories: [],
        maintenanceResponsibility: 'owner',
        insuranceRequirement: true
      },
      responsibilities: {
        customer: [
          'استخدام المعدات حسب الغرض المحدد',
          'الحفاظ على المعدات من التلف',
          'إرجاع المعدات في الحالة المتفق عليها',
          'دفع المبالغ في الوقت المحدد'
        ],
        owner: [
          'تأمين المعدات في حالة جيدة',
          'توفير الصيانة اللازمة',
          'تسليم المعدات في الوقت المحدد',
          'توفير الدعم الفني عند الحاجة'
        ]
      },
      termination: {
        noticePeriod: 7, // 7 أيام
        penalties: {
          earlyTermination: booking.total_amount * 0.3, // 30%
          damage: booking.total_amount * 0.5, // 50%
          lateReturn: booking.total_amount * 0.1 // 10% يومياً
        }
      },
      disputeResolution: {
        method: 'mediation',
        jurisdiction: 'بغداد، العراق',
        language: 'العربية'
      }
    };
  }

  private async calculateTerminationPenalties(contract: DigitalContract): Promise<any> {
    const today = new Date();
    const daysRemaining = Math.ceil((new Date(contract.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining > 0) {
      return {
        earlyTermination: contract.terms.termination.penalties.earlyTermination,
        reason: 'إنهاء قبل نهاية الفترة'
      };
    }

    return {};
  }

  private async verifySignature(signatureId: string): Promise<void> {
    // التحقق من التوقيع الرقمي
    await query(
      'UPDATE digital_signatures SET verified = true WHERE id = $1',
      [signatureId]
    );
  }

  private async sendContractNotifications(contract: DigitalContract): Promise<void> {
    // إشعار للعميل
    await this.notificationService.sendNotification({
      userId: contract.customerId,
      type: 'system',
      title: 'عقد إيجار جديد',
      message: 'تم إنشاء عقد الإيجار الخاص بك. يرجى مراجعة والتوقيع',
      data: { contractId: contract.id }
    });

    // إشعار للمالك
    await this.notificationService.sendNotification({
      userId: contract.ownerId,
      type: 'system',
      title: 'عقد إيجار جديد',
      message: 'تم إنشاء عقد إيجار جديد. يرجى مراجعة والتوقيع',
      data: { contractId: contract.id }
    });
  }

  private async sendSignatureNotifications(contractId: string, signerType: 'customer' | 'owner'): Promise<void> {
    const contract = await this.getContract(contractId);
    const otherPartyId = signerType === 'customer' ? contract.ownerId : contract.customerId;

    await this.notificationService.sendNotification({
      userId: otherPartyId,
      type: 'system',
      title: 'تم توقيع العقد',
      message: `قام ${signerType === 'customer' ? 'العميل' : 'المالك'} بتوقيع العقد`,
      data: { contractId }
    });
  }

  private async sendTerminationNotifications(contract: DigitalContract, reason: string, penalties: any): Promise<void> {
    // إشعار للطرفين
    await this.notificationService.sendNotification({
      userId: contract.customerId,
      type: 'system',
      title: 'تم إنهاء العقد',
      message: `تم إنهاء العقد رقم ${contract.id}. السبب: ${reason}`,
      data: { contractId: contract.id, penalties }
    });

    await this.notificationService.sendNotification({
      userId: contract.ownerId,
      type: 'system',
      title: 'تم إنهاء العقد',
      message: `تم إنهاء العقد رقم ${contract.id}. السبب: ${reason}`,
      data: { contractId: contract.id, penalties }
    });
  }

  private async getContract(contractId: string): Promise<DigitalContract> {
    const result = await query('SELECT * FROM digital_contracts WHERE id = $1', [contractId]);
    return this.mapRowToContract(result.rows[0]);
  }

  private async getContractSignatures(contractId: string): Promise<DigitalSignature[]> {
    const result = await query('SELECT * FROM digital_signatures WHERE contract_id = $1 ORDER BY signed_at', [contractId]);
    return result.rows.map(row => this.mapRowToSignature(row));
  }

  private mapRowToContract(row: any): DigitalContract {
    return {
      id: row.id,
      bookingId: row.booking_id,
      equipmentId: row.equipment_id,
      customerId: row.customer_id,
      ownerId: row.owner_id,
      type: row.type,
      status: row.status,
      terms: row.terms,
      signatures: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startDate: row.start_date,
      endDate: row.end_date,
      totalAmount: row.total_amount,
      currency: row.currency,
      specialConditions: row.special_conditions,
      attachments: row.attachments
    };
  }

  private mapRowToSignature(row: any): DigitalSignature {
    return {
      id: row.id,
      contractId: row.contract_id,
      signerId: row.signer_id,
      signerType: row.signer_type,
      signatureData: row.signature_data,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      signedAt: row.signed_at,
      verified: row.verified,
      verificationMethod: row.verification_method
    };
  }

  private mapRowToTemplate(row: any): ContractTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      language: row.language,
      terms: row.terms,
      isActive: row.is_active,
      usageCount: row.usage_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default new ContractService();
