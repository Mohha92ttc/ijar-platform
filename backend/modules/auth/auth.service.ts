import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../../database/connection';
import { RegisterDTO, LoginResponse, UserRole } from './auth.types';
import { NotificationService } from '../notifications/notification.service';
import { mailService } from '../../services/mail.service';

interface MeResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at: Date;
  subscription_status: string | null;
  subscription_end_date: Date | null;
}

export class AuthService {
  private readonly JWT_EXPIRES_IN = '24h';
  private readonly notificationService = new NotificationService();
  private readonly bcryptRounds = Math.max(10, parseInt(process.env.BCRYPT_ROUNDS || '12', 10) || 12);

  private get jwtSecret(): string {
    const s = process.env.JWT_SECRET || '';
    if (!s || s.length < 16) {
      throw new Error('JWT_SECRET is not configured securely');
    }
    return s;
  }

  private normalizeRole(role?: string): UserRole {
    if (role === 'admin') {
      throw new Error('غير مسموح بتسجيل حساب مسؤول نظام يدوياً');
    }
    if (role === 'owner') return 'owner';
    return 'customer';
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private assertPassword(password: string) {
    if (!password || password.length < 8) {
      throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }
  }

  async register(data: RegisterDTO): Promise<LoginResponse> {
    this.assertPassword(data.password);
    const role = this.normalizeRole(data.role);
    const dup = await query(`SELECT id FROM users WHERE email = $1`, [data.email]);
    if (dup.rows.length > 0) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, this.bcryptRounds);
    const phone = (data.phone && data.phone.replace(/\s/g, '')) || `+964000${Date.now().toString().slice(-7)}`;

    const autoApprove = Boolean(data.auto_approve);
    const isApproved = role === 'customer' || role === 'admin' || autoApprove;
    // Customers: mark verified only when SMTP not configured (dev), else require verify link
    const emailVerified = role !== 'customer' ? true : !mailService.isConfigured();
    const verificationToken = !emailVerified ? this.generateSecureToken() : null;

    const ins = await query(
      `
      INSERT INTO users (name, email, phone, password, role, is_email_verified, is_approved, verification_token, subscription_status)
      VALUES ($1, $2, $3, $4, $5::user_role, $6, $7, $8, $9)
      RETURNING id, name, email, role
    `,
      [
        data.name,
        data.email,
        phone,
        hashedPassword,
        role,
        emailVerified,
        isApproved,
        verificationToken,
        autoApprove && role === 'owner' ? 'active' : role === 'owner' ? 'pending' : 'none',
      ]
    );

    const row = ins.rows[0];

    if (role === 'owner' && !isApproved) {
      await this.notificationService.notifyAdmins({
        type: 'partner_approval',
        title: 'طلب انضمام شريك جديد',
        message: `الشريك ${data.name} (${data.email}) أنشأ حساباً وبانتظار الموافقة.`,
        related_id: String(row.id),
      });
      await this.notificationService.create({
        user_id: String(row.id),
        type: 'partner_approval',
        title: 'طلبك قيد المراجعة',
        message: 'تم استلام طلب انضمامك كشريك. ستصلك إشعارات عند الموافقة أو الرفض.',
        related_id: String(row.id),
      });

      // No session token for unapproved partners — avoids misleading UI login
      return {
        pending: true,
        message: 'تم إنشاء الحساب وبانتظار موافقة الإدارة. لا يمكن تسجيل الدخول قبل الموافقة.',
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
        },
      };
    }

    if (verificationToken) {
      const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173';
      await mailService.send({
        to: data.email,
        subject: 'تأكيد البريد — إيجار',
        text: `يرجى تأكيد بريدك عبر الرابط: ${appUrl}/api/auth/verify-email/${verificationToken}`,
      });
    }

    const token = jwt.sign({ userId: row.id, role: row.role }, this.jwtSecret, { expiresIn: this.JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
      },
    };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await query(
      `SELECT id, name, email, role, password, is_approved, is_email_verified, subscription_status
       FROM users WHERE email = $1`,
      [email]
    );
    if (res.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const row = res.rows[0];
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) {
      throw new Error('Invalid credentials');
    }

    if (row.subscription_status === 'banned') {
      throw new Error('Account is banned');
    }

    if (!row.is_approved) {
      throw new Error('Account is pending approval');
    }

    if (row.role === 'customer' && !row.is_email_verified) {
      throw new Error('Email verification required');
    }

    if (row.role === 'courier') {
      const c = await query(`SELECT is_active FROM couriers WHERE user_id = $1 LIMIT 1`, [row.id]);
      if (!c.rows[0] || !c.rows[0].is_active) {
        throw new Error('حساب المندوب غير نشط — تواصل مع الشريك');
      }
    }

    const token = jwt.sign({ userId: row.id, role: row.role }, this.jwtSecret, { expiresIn: this.JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
      },
    };
  }

  async verifyEmail(token: string): Promise<void> {
    if (!token || token.length < 20) {
      throw new Error('Invalid verification token');
    }

    const res = await query(
      `
      UPDATE users
      SET is_email_verified = true,
          verification_token = NULL
      WHERE verification_token = $1
      RETURNING id
      `,
      [token]
    );

    if (res.rows.length === 0) {
      throw new Error('Verification token is invalid or expired');
    }
  }

  async getMe(userId: string): Promise<MeResponse> {
    const res = await query(
      `SELECT id, name, email, phone, role, created_at, subscription_status, subscription_end_date FROM users WHERE id = $1`,
      [userId]
    );
    if (res.rows.length === 0) {
      throw new Error('User not found');
    }
    return res.rows[0];
  }

  async updateMe(userId: string, data: { name?: string; email?: string; phone?: string; currentPassword?: string; newPassword?: string }): Promise<void> {
    if (data.newPassword && data.currentPassword) {
      this.assertPassword(data.newPassword);
      const res = await query(`SELECT password FROM users WHERE id = $1`, [userId]);
      if (res.rows.length > 0) {
        const ok = await bcrypt.compare(data.currentPassword, res.rows[0].password);
        if (!ok) throw new Error('كلمة المرور الحالية غير صحيحة');
        const hashedPassword = await bcrypt.hash(data.newPassword, this.bcryptRounds);
        await query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, userId]);
      }
    }

    if (data.name || data.email || data.phone) {
      const updates: string[] = [];
      const values: string[] = [];
      let i = 1;

      if (data.name) {
        updates.push(`name = $${i++}`);
        values.push(data.name);
      }
      if (data.email) {
        updates.push(`email = $${i++}`);
        values.push(data.email);
      }
      if (data.phone) {
        updates.push(`phone = $${i++}`);
        values.push(data.phone);
      }

      if (updates.length > 0) {
        values.push(userId);
        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`, values);
      }
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const res = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (res.rows.length === 0) return;

    const resetToken = this.generateSecureToken();
    const expires = new Date(Date.now() + 1000 * 60 * 30);

    await query(
      `
      UPDATE users
      SET reset_password_token = $1,
          reset_password_expires = $2
      WHERE id = $3
      `,
      [resetToken, expires, res.rows[0].id]
    );

    await mailService.send({
      to: email,
      subject: 'إعادة تعيين كلمة المرور — إيجار',
      text: `رمز إعادة التعيين: ${resetToken}`,
    });
  }

  async requestPasswordResetWithAdminApproval(email: string): Promise<void> {
    const res = await query(`SELECT id, role FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (res.rows.length === 0) return;
    const userId = String(res.rows[0].id);
    const role = String(res.rows[0].role);
    if (!['customer', 'owner'].includes(role)) {
      throw new Error('Only customer and owner accounts are allowed');
    }

    const existing = await query(
      `
      SELECT id FROM password_reset_requests
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );
    if (existing.rows.length > 0) {
      return;
    }

    await query(
      `
      INSERT INTO password_reset_requests (user_id, requested_email, status)
      VALUES ($1, $2, 'pending')
      `,
      [userId, email]
    );

    await this.notificationService.notifyAdmins({
      type: 'system',
      title: 'طلب نسيان كلمة مرور جديد',
      message: `يوجد طلب جديد لتغيير كلمة المرور للحساب: ${email}`,
      related_id: userId,
    });
  }

  async getPasswordResetStatusByEmail(email: string): Promise<{ status: string; requestId?: string }> {
    const userRes = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (userRes.rows.length === 0) return { status: 'not_found' };
    const userId = String(userRes.rows[0].id);
    const reqRes = await query(
      `
      SELECT id, status
      FROM password_reset_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );
    if (reqRes.rows.length === 0) return { status: 'none' };
    return { status: String(reqRes.rows[0].status), requestId: String(reqRes.rows[0].id) };
  }

  /**
   * Completing reset requires the one-time completion_token issued when admin approved.
   */
  async completeApprovedPasswordResetByEmail(
    email: string,
    newPassword: string,
    completionToken: string
  ): Promise<void> {
    this.assertPassword(newPassword);
    if (!completionToken || completionToken.length < 20) {
      throw new Error('رمز التأكيد مطلوب وغير صالح');
    }
    const userRes = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (userRes.rows.length === 0) throw new Error('User not found');
    const userId = String(userRes.rows[0].id);
    const reqRes = await query(
      `
      SELECT id
      FROM password_reset_requests
      WHERE user_id = $1
        AND status = 'approved'
        AND completion_token = $2
        AND completion_token_expires IS NOT NULL
        AND completion_token_expires > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId, completionToken]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('رمز التأكيد غير صالح أو منتهٍ أو الطلب غير موافق عليه');
    }
    const requestId = String(reqRes.rows[0].id);
    const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
    await query(`UPDATE users SET password = $1 WHERE id = $2`, [hashedPassword, userId]);
    await query(
      `
      UPDATE password_reset_requests
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          completion_token = NULL,
          completion_token_expires = NULL
      WHERE id = $1
      `,
      [requestId]
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || token.length < 20) {
      throw new Error('Invalid reset token');
    }
    this.assertPassword(newPassword);

    const userRes = await query(
      `
      SELECT id
      FROM users
      WHERE reset_password_token = $1
        AND reset_password_expires IS NOT NULL
        AND reset_password_expires > NOW()
      LIMIT 1
      `,
      [token]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Reset token is invalid or expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
    await query(
      `
      UPDATE users
      SET password = $1,
          reset_password_token = NULL,
          reset_password_expires = NULL
      WHERE id = $2
      `,
      [hashedPassword, userRes.rows[0].id]
    );
  }
}
