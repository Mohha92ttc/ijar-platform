import { Request, Response } from 'express';
import { mailService } from '../../services/mail.service';
import { publicError } from '../../utils/publicError';
import { query } from '../../database/connection';

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
        `SELECT id, name, email, category, message, status, admin_notes, booking_id, created_at, updated_at
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
      const actor = (req as Request & { user?: { userId?: string } }).user;
      if (!actor?.userId) return res.status(401).json({ error: 'Unauthorized' });
      const u = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [actor.userId]);
      const email = String(u.rows[0]?.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'لا بريد على الحساب' });
      const r = await query(
        `
        SELECT id, category, message, status, admin_notes, booking_id, created_at, updated_at
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

  async updateMessage(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const status = String(req.body?.status || 'open');
      const admin_notes =
        req.body?.admin_notes != null ? String(req.body.admin_notes) : undefined;
      const updated = await query(
        `
        UPDATE support_messages
        SET status = $1,
            admin_notes = COALESCE($2, admin_notes),
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, email, status, admin_notes, booking_id
        `,
        [status, admin_notes ?? null, id]
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
              status === 'resolved' ? 'تم حل طلب الدعم' : status === 'in_progress' ? 'طلب الدعم قيد المتابعة' : 'تحديث على طلب الدعم';
            await ns.create({
              user_id: String(userRes.rows[0].id),
              type: 'system',
              title: st,
              message: row.admin_notes
                ? `ملاحظة الإدارة: ${String(row.admin_notes).slice(0, 200)}`
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

  // Support tickets
  async createTicket(req: Request, res: Response) {
    try {
      const { subject, description, priority, category } = req.body;
      // Mock implementation - would integrate with supportService
      const ticket = {
        id: 'ticket_001',
        subject,
        description,
        priority: priority || 'medium',
        category: category || 'general',
        status: 'open',
        createdAt: new Date().toISOString()
      };
      res.status(201).json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  },

  async getTickets(req: Request, res: Response) {
    try {
      // Mock implementation
      const tickets = [
        {
          id: 'ticket_001',
          subject: 'مشكلة في الدفع',
          description: 'لا يمكنني الدفع عبر البطاقة',
          priority: 'high',
          category: 'payment',
          status: 'open'
        }
      ];
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get tickets' });
    }
  },

  async getTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Mock implementation
      const ticket = {
        id: 'ticket_001',
        subject: 'مشكلة في الدفع',
        description: 'لا يمكنني الدفع عبر البطاقة',
        priority: 'high',
        category: 'payment',
        status: 'open'
      };
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get ticket' });
    }
  },

  async updateTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;
      // Mock implementation
      const updatedTicket = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      res.json(updatedTicket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  },

  async deleteTicket(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Mock implementation
      res.json({ message: 'Ticket deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  },

  // Live chat
  async startChatSession(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      // Mock implementation - would integrate with supportService
      const chatSession = {
        id: 'session_001',
        userId,
        status: 'active',
        agentId: null,
        startedAt: new Date().toISOString()
      };
      res.status(201).json(chatSession);
    } catch (error) {
      res.status(500).json({ error: 'Failed to start chat session' });
    }
  },

  async sendChatMessage(req: Request, res: Response) {
    try {
      const { sessionId, message, sender } = req.body;
      // Mock implementation
      const chatMessage = {
        id: 'message_001',
        sessionId,
        message,
        sender,
        timestamp: new Date().toISOString()
      };
      res.status(201).json(chatMessage);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send chat message' });
    }
  },

  async getChatMessages(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      // Mock implementation
      const messages = [
        {
          id: 'message_001',
          sessionId,
          message: 'مرحباً، كيف يمكنني مساعدتك؟',
          sender: 'user',
          timestamp: new Date().toISOString()
        },
        {
          id: 'message_002',
          sessionId,
          message: 'أنا موجود لمساعدتك في حل مشكلة الدفع',
          sender: 'agent',
          timestamp: new Date().toISOString()
        }
      ];
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get chat messages' });
    }
  },

  async endChatSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      // Mock implementation
      const endedSession = {
        sessionId,
        status: 'ended',
        endedAt: new Date().toISOString()
      };
      res.json(endedSession);
    } catch (error) {
      res.status(500).json({ error: 'Failed to end chat session' });
    }
  },

  // Knowledge base
  async getKnowledgeBase(req: Request, res: Response) {
    try {
      // Mock implementation
      const knowledgeBase = [
        {
          id: 'kb_001',
          title: 'كيفية الدفع',
          category: 'payment',
          content: 'يمكنك الدفع عبر البطاقة أو البطاقة الإلكترونية',
          tags: ['payment', 'billing', 'credit_card'],
          views: 1250,
          helpful: true
        }
      ];
      res.json(knowledgeBase);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get knowledge base' });
    }
  },

  async searchKnowledgeBase(req: Request, res: Response) {
    try {
      const { query } = req.body;
      // Mock implementation
      const searchResults = [
        {
          id: 'kb_001',
          title: 'كيفية الدفع',
          category: 'payment',
          content: 'يمكنك الدفع عبر البطاقة أو البطاقة الإلكترونية',
          tags: ['payment', 'billing', 'credit_card'],
          relevance: 0.95
        }
      ];
      res.json(searchResults);
    } catch (error) {
      res.status(500).json({ error: 'Failed to search knowledge base' });
    }
  },

  // Support analytics
  async getSupportAnalytics(req: Request, res: Response) {
    try {
      // Mock implementation
      const analytics = {
        totalTickets: 500,
        openTickets: 45,
        resolvedTickets: 420,
        averageResponseTime: '2.5_hours',
        customerSatisfaction: 4.2,
        chatSessions: 150,
        knowledgeBaseViews: 5000
      };
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get support analytics' });
    }
  }
};
