import { Request, Response } from 'express';
import { mailService } from '../../services/mail.service';
import { publicError } from '../../utils/publicError';
import { query } from '../../database/connection';

type Actor = { userId?: string; id?: string; role?: string; email?: string };

function getActor(req: Request): Actor | undefined {
  return (req as Request & { user?: Actor }).user;
}

function actorUserId(actor?: Actor): string | undefined {
  return actor?.userId || actor?.id;
}

const FAQ_KNOWLEDGE = [
  {
    id: 'faq_01',
    title: 'كيف يمكنني تأجير معداتي على المنصة؟',
    category: 'general',
    content:
      'أنشئ حساب شريك، وبعد موافقة الإدارة أضف معداتك من لوحة الشريك مع الصور والسعر والموقع.',
    tags: ['شريك', 'تأجير', 'معدات'],
  },
  {
    id: 'faq_02',
    title: 'ما هي رسوم المنصة؟',
    category: 'billing',
    content:
      'عمولة المنصة قابلة للضبط من إعدادات الإدارة وتُحتسب على عمليات الإيجار المعتمدة. لا توجد رسوم خفية على الزبون.',
    tags: ['رسوم', 'عمولة', 'فوترة'],
  },
  {
    id: 'faq_03',
    title: 'كيف يتم الدفع والتسليم؟',
    category: 'billing',
    content:
      'حالياً متاح التحويل (زين كاش / آسيا حوالة / يدوي مع إثبات) أو الدفع عند التسليم، مع خيار طلب توصيل وتحديد الموقع على الخريطة. راجع بيانات استلام الشريك عند الدفع.',
    tags: ['دفع', 'تسليم', 'تحويل'],
  },
  {
    id: 'faq_04',
    title: 'ماذا لو تعطلت المعدات أثناء التأجير؟',
    category: 'technical',
    content: 'تواصل مع الشريك أولاً، أو أرسل شكوى عبر نموذج المساعدة أدناه ليراجعها فريق الدعم.',
    tags: ['عطل', 'شكوى', 'دعم'],
  },
  {
    id: 'faq_05',
    title: 'كيف يمكنني إلغاء الحجز؟',
    category: 'general',
    content:
      'من لوحة «حجوزاتي» يمكنك إلغاء الحجوزات بحالة «في الانتظار» فقط، مع ذكر السبب. بعد تأكيد الشريك لا يمكن الإلغاء من اللوحة — تواصل مع الشريك أو افتح شكوى عبر الدعم.',
    tags: ['إلغاء', 'حجز'],
  },
  {
    id: 'faq_06',
    title: 'هل التقييمات تظهر للعامة؟',
    category: 'general',
    content:
      'نعم. بعد إكمال الإيجار يمكنك تقييم التجربة، وتظهر التقييمات داخل نافذة حجز المعدة للزبائن الآخرين.',
    tags: ['تقييم', 'مراجعات'],
  },
];

function rowToTicket(row: Record<string, unknown>) {
  const message = String(row.message || '');
  const firstLine = message.split('\n').find((l) => l.trim()) || message;
  return {
    id: String(row.id),
    subject: firstLine.slice(0, 120) || String(row.category || 'طلب دعم'),
    description: message,
    category: String(row.category || 'general'),
    status: String(row.status || 'open'),
    name: row.name != null ? String(row.name) : undefined,
    email: row.email != null ? String(row.email) : undefined,
    admin_notes: row.admin_notes != null ? String(row.admin_notes) : null,
    admin_reply: row.admin_reply != null ? String(row.admin_reply) : null,
    customer_reply: row.customer_reply != null ? String(row.customer_reply) : null,
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const TICKET_SELECT = `
  id, name, email, category, message, status, admin_notes, admin_reply,
  customer_reply, booking_id, created_at, updated_at
`;

export const supportController = {
  /** Public contact form from Help page (no auth). */
  async submitContact(req: Request, res: Response) {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim();
      const category = String(req.body?.category || 'general').trim();
      const message = String(req.body?.message || '').trim();
      const bookingIdRaw = req.body?.booking_id != null ? String(req.body.booking_id).trim() : '';
      const bookingId = bookingIdRaw && /^[0-9a-f-]{36}$/i.test(bookingIdRaw) ? bookingIdRaw : null;

      if (!name || name.length < 2) {
        return res.status(400).json({ error: 'الاسم مطلوب' });
      }
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'بريد إلكتروني غير صالح' });
      }
      if (!message || message.length < 10) {
        return res.status(400).json({ error: 'الرسالة قصيرة جداً (10 أحرف على الأقل)' });
      }

      const inserted = await query(
        `
        INSERT INTO support_messages (name, email, category, message, booking_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [name, email, category, message, bookingId]
      );
      const ticketId = String(inserted.rows[0]?.id || '');

      const supportTo =
        process.env.SUPPORT_EMAIL ||
        process.env.EMAIL_FROM ||
        process.env.SMTP_USER ||
        'support@ijar.iq';

      const subject = `[إيجار دعم] ${category} — ${name}${bookingId ? ` — حجز ${bookingId.slice(0, 8)}` : ''}`;
      const text = `الاسم: ${name}\nالبريد: ${email}\nالنوع: ${category}\nرقم الطلب: ${ticketId}\nحجز مرتبط: ${bookingId || '—'}\n\n${message}`;

      let mailSent = false;
      if (mailService.isConfigured()) {
        mailSent = await mailService.send({ to: supportTo, subject, text });
        if (mailSent) {
          await mailService.send({
            to: email,
            subject: 'استلمنا رسالتك — إيجار',
            text: `مرحباً ${name}،\n\nاستلمنا رسالتك وسنرد خلال 24 ساعة.\nرقم الطلب: ${ticketId}\n\nنوع الطلب: ${category}`,
          });
        }
      } else {
        console.warn('[support contact saved]', ticketId, subject);
      }

      res.status(201).json({
        message: mailSent
          ? 'تم إرسال رسالتك بنجاح'
          : 'تم حفظ رسالتك لدى الإدارة. إن تعذّر البريد راسلنا هاتفياً أيضاً.',
        id: ticketId,
        mail_sent: mailSent,
      });
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل إرسال الرسالة') });
    }
  },

  async listMessages(_req: Request, res: Response) {
    try {
      const r = await query(
        `SELECT ${TICKET_SELECT}
         FROM support_messages ORDER BY created_at DESC LIMIT 100`
      );
      res.json(r.rows);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب الرسائل') });
    }
  },

  /** الزبون يرى تذاكره عبر بريده المسجّل */
  async listMyMessages(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      if (!actorUserId(actor)) return res.status(401).json({ error: 'Unauthorized' });
      const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [actorUserId(actor)]);
      const email = String(u.rows[0]?.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'لا بريد على الحساب' });
      const r = await query(
        `
        SELECT id, category, message, status, admin_notes, admin_reply, customer_reply, booking_id, created_at, updated_at
        FROM support_messages
        WHERE LOWER(email) = $1
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [email]
      );
      res.json(r.rows);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب تذاكرك') });
    }
  },

  /** الزبون يرد على تذكرة بعد رد الإدارة */
  async replyMyMessage(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      if (!actorUserId(actor)) return res.status(401).json({ error: 'Unauthorized' });
      const id = req.params.id;
      const reply = String(req.body?.reply || '').trim();
      if (reply.length < 5) {
        return res.status(400).json({ error: 'الرد قصير جداً (5 أحرف على الأقل)' });
      }
      const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [actorUserId(actor)]);
      const email = String(u.rows[0]?.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'لا بريد على الحساب' });
      const updated = await query(
        `
        UPDATE support_messages
        SET customer_reply = $1,
            status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
            updated_at = NOW()
        WHERE id = $2 AND LOWER(email) = $3
        RETURNING id, booking_id
        `,
        [reply.slice(0, 2000), id, email]
      );
      if (!updated.rows[0]) return res.status(404).json({ error: 'التذكرة غير موجودة' });
      try {
        const { NotificationService } = await import('../notifications/notification.service');
        const ns = new NotificationService();
        await ns.notifyAdmins({
          type: 'system',
          title: 'رد زبون على تذكرة دعم',
          message: reply.slice(0, 180),
          related_id: String(updated.rows[0].booking_id || updated.rows[0].id),
        });
      } catch {
        // non-blocking
      }
      res.json({ ok: true });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل إرسال الرد') });
    }
  },

  async updateMessage(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const status = String(req.body?.status || 'open');
      const admin_notes =
        req.body?.admin_notes != null ? String(req.body.admin_notes) : undefined;
      const admin_reply =
        req.body?.admin_reply != null ? String(req.body.admin_reply) : undefined;
      // Prefer admin_reply when provided; also mirror into admin_notes for customer-facing "رد الإدارة"
      const notesValue =
        admin_reply !== undefined
          ? admin_reply
          : admin_notes !== undefined
            ? admin_notes
            : null;
      const updated = await query(
        `
        UPDATE support_messages
        SET status = $1,
            admin_notes = COALESCE($2, admin_notes),
            admin_reply = COALESCE($3, admin_reply),
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, email, status, admin_notes, admin_reply, booking_id
        `,
        [
          status,
          notesValue,
          admin_reply !== undefined ? admin_reply : admin_notes !== undefined ? admin_notes : null,
          id,
        ]
      );
      const row = updated.rows[0];
      if (row?.email) {
        try {
          const { NotificationService } = await import('../notifications/notification.service');
          const ns = new NotificationService();
          const userRes = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
            String(row.email),
          ]);
          if (userRes.rows[0]?.id) {
            const st =
              status === 'resolved'
                ? 'تم حل طلب الدعم'
                : status === 'in_progress'
                  ? 'طلب الدعم قيد المتابعة'
                  : 'تحديث على طلب الدعم';
            const replyText = row.admin_reply || row.admin_notes;
            await ns.create({
              user_id: String(userRes.rows[0].id),
              type: 'system',
              title: st,
              message: replyText
                ? `رد الإدارة: ${String(replyText).slice(0, 200)}`
                : `حالة طلبك أصبحت: ${status}`,
              related_id: row.booking_id ? String(row.booking_id) : String(row.id),
            });
          }
        } catch {
          // non-blocking
        }
      }
      res.json({ ok: true });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل التحديث') });
    }
  },

  // Support tickets (backed by support_messages)
  async createTicket(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const subject = String(req.body?.subject || '').trim();
      const description = String(req.body?.description || '').trim();
      const category = String(req.body?.category || 'general').trim() || 'general';
      const bookingIdRaw = req.body?.booking_id != null ? String(req.body.booking_id).trim() : '';
      const bookingId = bookingIdRaw && /^[0-9a-f-]{36}$/i.test(bookingIdRaw) ? bookingIdRaw : null;

      if (!subject && !description) {
        return res.status(400).json({ error: 'الموضوع أو الوصف مطلوب' });
      }

      const u = await query(`SELECT name, email FROM users WHERE id = $1 LIMIT 1`, [userId]);
      const name = String(u.rows[0]?.name || 'مستخدم').trim() || 'مستخدم';
      const email = String(u.rows[0]?.email || '').trim();
      if (!email) return res.status(400).json({ error: 'لا بريد على الحساب' });

      const message = [subject, description].filter(Boolean).join('\n\n').slice(0, 5000);

      const inserted = await query(
        `
        INSERT INTO support_messages (name, email, category, message, booking_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${TICKET_SELECT}
        `,
        [name, email, category, message, bookingId]
      );
      res.status(201).json(rowToTicket(inserted.rows[0] as Record<string, unknown>));
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل إنشاء التذكرة') });
    }
  },

  async getTickets(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const isAdmin = actor?.role === 'admin';
      let rows;
      if (isAdmin) {
        const r = await query(
          `SELECT ${TICKET_SELECT} FROM support_messages ORDER BY created_at DESC LIMIT 100`
        );
        rows = r.rows;
      } else {
        const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const email = String(u.rows[0]?.email || '').trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'لا بريد على الحساب' });
        const r = await query(
          `SELECT ${TICKET_SELECT} FROM support_messages WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 50`,
          [email]
        );
        rows = r.rows;
      }
      res.json(rows.map((row) => rowToTicket(row as Record<string, unknown>)));
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب التذاكر') });
    }
  },

  async getTicket(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = req.params;

      const r = await query(`SELECT ${TICKET_SELECT} FROM support_messages WHERE id = $1 LIMIT 1`, [
        id,
      ]);
      const row = r.rows[0] as Record<string, unknown> | undefined;
      if (!row) return res.status(404).json({ error: 'التذكرة غير موجودة' });

      if (actor?.role !== 'admin') {
        const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const email = String(u.rows[0]?.email || '').trim().toLowerCase();
        if (!email || String(row.email || '').trim().toLowerCase() !== email) {
          return res.status(403).json({ error: 'غير مصرح' });
        }
      }

      res.json(rowToTicket(row));
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب التذكرة') });
    }
  },

  async updateTicket(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      if (actor?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const { id } = req.params;
      const status =
        req.body?.status != null ? String(req.body.status) : undefined;
      const admin_notes =
        req.body?.admin_notes != null ? String(req.body.admin_notes) : undefined;
      const admin_reply =
        req.body?.admin_reply != null ? String(req.body.admin_reply) : undefined;

      const updated = await query(
        `
        UPDATE support_messages
        SET status = COALESCE($1, status),
            admin_notes = COALESCE($2, admin_notes),
            admin_reply = COALESCE($3, admin_reply),
            updated_at = NOW()
        WHERE id = $4
        RETURNING ${TICKET_SELECT}
        `,
        [
          status ?? null,
          admin_notes ?? admin_reply ?? null,
          admin_reply ?? admin_notes ?? null,
          id,
        ]
      );
      if (!updated.rows[0]) return res.status(404).json({ error: 'التذكرة غير موجودة' });
      res.json(rowToTicket(updated.rows[0] as Record<string, unknown>));
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل تحديث التذكرة') });
    }
  },

  async deleteTicket(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      if (actor?.role !== 'admin') {
        return res.status(403).json({ error: 'للإدارة فقط' });
      }
      const { id } = req.params;
      const deleted = await query(
        `DELETE FROM support_messages WHERE id = $1 RETURNING id`,
        [id]
      );
      if (!deleted.rows[0]) return res.status(404).json({ error: 'التذكرة غير موجودة' });
      res.json({ message: 'تم حذف التذكرة', id: String(deleted.rows[0].id) });
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل حذف التذكرة') });
    }
  },

  // Live chat — thread over the caller's support_messages (no fake session IDs)
  async startChatSession(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const u = await query(`SELECT name, email FROM users WHERE id = $1 LIMIT 1`, [userId]);
      const email = String(u.rows[0]?.email || '').trim().toLowerCase();
      const name = String(u.rows[0]?.name || 'مستخدم');
      if (!email) return res.status(400).json({ error: 'لا بريد على الحساب' });

      const open = await query(
        `
        SELECT id FROM support_messages
        WHERE LOWER(email) = $1 AND status IN ('open', 'in_progress')
        ORDER BY created_at DESC LIMIT 1
        `,
        [email]
      );
      let sessionId = open.rows[0]?.id ? String(open.rows[0].id) : '';
      if (!sessionId) {
        const inserted = await query(
          `
          INSERT INTO support_messages (name, email, category, message, status)
          VALUES ($1, $2, 'general', $3, 'open')
          RETURNING id
          `,
          [name, email, 'جلسة دردشة دعم — بانتظار رسالة الزبون']
        );
        sessionId = String(inserted.rows[0].id);
      }

      res.status(201).json({
        id: sessionId,
        userId,
        status: 'active',
        startedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل بدء الجلسة') });
    }
  },

  async sendChatMessage(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sessionId = String(req.body?.sessionId || req.params.sessionId || '').trim();
      const message = String(req.body?.message || '').trim();
      const sender = String(req.body?.sender || 'user').trim();
      if (!sessionId || message.length < 2) {
        return res.status(400).json({ error: 'الجلسة والرسالة مطلوبان' });
      }

      const existing = await query(
        `SELECT id, email, message, admin_reply, customer_reply FROM support_messages WHERE id = $1 LIMIT 1`,
        [sessionId]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: 'الجلسة غير موجودة' });

      if (actor?.role !== 'admin') {
        const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const email = String(u.rows[0]?.email || '').trim().toLowerCase();
        if (String(existing.rows[0].email || '').toLowerCase() !== email) {
          return res.status(403).json({ error: 'غير مصرح' });
        }
        await query(
          `
          UPDATE support_messages
          SET customer_reply = $1,
              status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
              updated_at = NOW()
          WHERE id = $2
          `,
          [message.slice(0, 2000), sessionId]
        );
      } else {
        await query(
          `
          UPDATE support_messages
          SET admin_reply = $1,
              admin_notes = COALESCE(admin_notes, $1),
              status = 'in_progress',
              updated_at = NOW()
          WHERE id = $2
          `,
          [message.slice(0, 2000), sessionId]
        );
      }

      res.status(201).json({
        id: sessionId,
        sessionId,
        message,
        sender,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل إرسال الرسالة') });
    }
  },

  async getChatMessages(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.params.sessionId || '').trim();

      const r = await query(
        `SELECT id, email, message, admin_reply, admin_notes, customer_reply, created_at, updated_at
         FROM support_messages WHERE id = $1 LIMIT 1`,
        [sessionId]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: 'الجلسة غير موجودة' });

      if (actor?.role !== 'admin') {
        const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const email = String(u.rows[0]?.email || '').trim().toLowerCase();
        if (String(row.email || '').toLowerCase() !== email) {
          return res.status(403).json({ error: 'غير مصرح' });
        }
      }

      const messages: Array<{
        id: string;
        sessionId: string;
        message: string;
        sender: string;
        timestamp: string;
      }> = [];
      if (row.message) {
        messages.push({
          id: `${row.id}-customer`,
          sessionId: String(row.id),
          message: String(row.message),
          sender: 'user',
          timestamp: new Date(row.created_at).toISOString(),
        });
      }
      const adminText = row.admin_reply || row.admin_notes;
      if (adminText) {
        messages.push({
          id: `${row.id}-admin`,
          sessionId: String(row.id),
          message: String(adminText),
          sender: 'agent',
          timestamp: new Date(row.updated_at || row.created_at).toISOString(),
        });
      }
      if (row.customer_reply) {
        messages.push({
          id: `${row.id}-reply`,
          sessionId: String(row.id),
          message: String(row.customer_reply),
          sender: 'user',
          timestamp: new Date(row.updated_at || row.created_at).toISOString(),
        });
      }
      res.json(messages);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب الرسائل') });
    }
  },

  async endChatSession(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      const userId = actorUserId(actor);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const sessionId = String(req.params.sessionId || '').trim();

      const existing = await query(
        `SELECT id, email FROM support_messages WHERE id = $1 LIMIT 1`,
        [sessionId]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: 'الجلسة غير موجودة' });

      if (actor?.role !== 'admin') {
        const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const email = String(u.rows[0]?.email || '').trim().toLowerCase();
        if (String(existing.rows[0].email || '').toLowerCase() !== email) {
          return res.status(403).json({ error: 'غير مصرح' });
        }
      }

      await query(
        `UPDATE support_messages SET status = 'resolved', updated_at = NOW() WHERE id = $1`,
        [sessionId]
      );
      res.json({
        sessionId,
        status: 'ended',
        endedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل إنهاء الجلسة') });
    }
  },

  // Knowledge base — static FAQ from HelpPage
  async getKnowledgeBase(_req: Request, res: Response) {
    try {
      res.json(
        FAQ_KNOWLEDGE.map((k) => ({
          ...k,
          views: 0,
          helpful: true,
        }))
      );
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب قاعدة المعرفة') });
    }
  },

  async searchKnowledgeBase(req: Request, res: Response) {
    try {
      const q = String(
        req.body?.query || req.query?.q || req.query?.query || ''
      )
        .trim()
        .toLowerCase();
      const results = FAQ_KNOWLEDGE.filter((k) => {
        if (!q) return true;
        const hay = `${k.title} ${k.content} ${k.tags.join(' ')} ${k.category}`.toLowerCase();
        return hay.includes(q);
      }).map((k) => ({
        ...k,
        relevance: q ? 0.9 : 1,
      }));
      res.json(results);
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل البحث') });
    }
  },

  // Support analytics from real support_messages
  async getSupportAnalytics(_req: Request, res: Response) {
    try {
      const stats = await query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_count,
          COUNT(*) FILTER (WHERE admin_reply IS NOT NULL OR admin_notes IS NOT NULL)::int AS replied_count
        FROM support_messages
      `);
      const row = stats.rows[0] || {};
      const byCategory = await query(`
        SELECT category, COUNT(*)::int AS count
        FROM support_messages
        GROUP BY category
        ORDER BY count DESC
      `);
      res.json({
        totalTickets: Number(row.total || 0),
        openTickets: Number(row.open_count || 0),
        inProgressTickets: Number(row.in_progress_count || 0),
        resolvedTickets: Number(row.resolved_count || 0),
        repliedTickets: Number(row.replied_count || 0),
        knowledgeBaseArticles: FAQ_KNOWLEDGE.length,
        byCategory: byCategory.rows,
      });
    } catch (error: unknown) {
      res.status(500).json({ error: publicError(error, 'فشل جلب الإحصائيات') });
    }
  },
};
