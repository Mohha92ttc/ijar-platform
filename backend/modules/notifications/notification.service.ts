import crypto from 'crypto';
import { query } from '../../database/connection';
import { Notification, CreateNotificationDTO, NotificationType } from './notification.types';
import { mailService } from '../../services/mail.service';

/** Map app notification types to DB enum notification_type */
function toDbType(type: NotificationType | string): string {
  switch (type) {
    case 'booking_confirmed':
    case 'booking_cancelled':
    case 'booking':
      return 'booking';
    case 'payment_received':
    case 'payment':
      return 'payment';
    case 'new_review':
    case 'review':
      return 'review';
    case 'partner_approval':
      return 'partner_approval';
    case 'message':
      return 'message';
    default:
      return 'system';
  }
}

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: String(row.type) as NotificationType,
    title: String(row.title),
    message: String(row.message),
    is_read: Boolean(row.is_read),
    related_id: row.related_id ? String(row.related_id) : undefined,
    created_at: new Date(String(row.created_at)),
  };
}

export class NotificationService {
  async create(data: CreateNotificationDTO): Promise<Notification> {
    const id = crypto.randomUUID();
    const dbType = toDbType(data.type);
    const related = data.related_id
      ? { related_id: data.related_id }
      : {};

    const res = await query(
      `
      INSERT INTO notifications (id, user_id, type, title, message, data, is_read)
      VALUES ($1, $2, $3::notification_type, $4, $5, $6::jsonb, false)
      RETURNING *
      `,
      [id, data.user_id, dbType, data.title, data.message, JSON.stringify(related)]
    );

    await this.sendEmail(data.user_id, data.title, data.message);
    return rowToNotification(res.rows[0]);
  }

  async notifyAdmins(payload: Omit<CreateNotificationDTO, 'user_id'>): Promise<void> {
    const admins = await query(
      `SELECT id FROM users WHERE role = 'admin'::user_role AND is_approved = TRUE`
    );
    for (const a of admins.rows) {
      await this.create({
        user_id: String(a.id),
        type: payload.type,
        title: payload.title,
        message: payload.message,
        related_id: payload.related_id,
      });
    }
  }

  private async sendEmail(userId: string, title: string, message: string): Promise<void> {
    try {
      const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
      const email = u.rows[0]?.email;
      if (!email) return;
      await mailService.send({
        to: String(email),
        subject: title,
        text: message,
      });
    } catch (err) {
      console.warn('[notification email]', err);
    }
  }

  async getByUser(userId: string): Promise<Notification[]> {
    const res = await query(
      `
      SELECT id, user_id, type, title, message, is_read, created_at,
             COALESCE(data->>'related_id', NULL) AS related_id
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId]
    );
    return res.rows.map(rowToNotification);
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
  }

  async delete(id: string, userId?: string): Promise<void> {
    if (userId) {
      await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [id, userId]);
    } else {
      await query(`DELETE FROM notifications WHERE id = $1`, [id]);
    }
  }
}
