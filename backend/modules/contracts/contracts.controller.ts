import { Response } from 'express';
import { query } from '../../database/connection';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { NotificationService } from '../../services/notification.service';

const notifications = new NotificationService();

function uid(req: AuthenticatedRequest): string | undefined {
  return req.user?.userId || req.user?.id;
}

function formatDate(d: unknown): string {
  try {
    return new Date(String(d)).toLocaleDateString('ar-IQ');
  } catch {
    return String(d || '');
  }
}

type BookingForTerms = {
  id: string;
  equipment_title: string;
  customer_name: string;
  owner_name: string;
  start_date: unknown;
  end_date: unknown;
  total_amount: number | string;
};

function buildArabicTerms(booking: BookingForTerms): string {
  return [
    'عقد إيجار معدات — منصة إيجار',
    '================================',
    `رقم الحجز: ${booking.id}`,
    `المعدة: ${booking.equipment_title}`,
    `المستأجر: ${booking.customer_name}`,
    `المالك/الشريك: ${booking.owner_name}`,
    `فترة الإيجار: من ${formatDate(booking.start_date)} إلى ${formatDate(booking.end_date)}`,
    `المبلغ الإجمالي: ${Number(booking.total_amount || 0).toLocaleString('ar-IQ')} دينار عراقي`,
    '',
    'الشروط:',
    '1. يلتزم المستأجر باستخدام المعدة للغرض المتفق عليه والمحافظة عليها.',
    '2. يلتزم المستأجر بإرجاع المعدة في الموعد المحدد وبحالة سليمة.',
    '3. أي تلف ناتج عن سوء الاستخدام يتحمله المستأجر وفق تقييم الشريك/الإدارة.',
    '4. الدفع وفق طريقة الدفع المسجّلة في الحجز.',
    '5. بعد التأكيد لا يُلغى الحجز إلا بالاتفاق مع الشريك أو عبر الدعم.',
    '',
    'بالتوقيع الإلكتروني يقرّ المستأجر بموافقته على هذه الشروط.',
  ].join('\n');
}

function fillTemplateBody(bodyText: string, booking: BookingForTerms): string {
  const filled = bodyText
    .replace(/\{\{equipment\}\}|\{equipment\}/gi, booking.equipment_title)
    .replace(/\{\{customer\}\}|\{customer\}/gi, booking.customer_name)
    .replace(/\{\{owner\}\}|\{owner\}/gi, booking.owner_name)
    .replace(/\{\{booking_id\}\}|\{booking_id\}/gi, booking.id)
    .replace(/\{\{start_date\}\}|\{start_date\}/gi, formatDate(booking.start_date))
    .replace(/\{\{end_date\}\}|\{end_date\}/gi, formatDate(booking.end_date))
    .replace(
      /\{\{amount\}\}|\{amount\}/gi,
      Number(booking.total_amount || 0).toLocaleString('ar-IQ')
    );
  return [
    filled.trim(),
    '',
    '--- بيانات الحجز ---',
    `رقم الحجز: ${booking.id}`,
    `المعدة: ${booking.equipment_title}`,
    `المستأجر: ${booking.customer_name}`,
    `المالك/الشريك: ${booking.owner_name}`,
    `فترة الإيجار: من ${formatDate(booking.start_date)} إلى ${formatDate(booking.end_date)}`,
    `المبلغ الإجمالي: ${Number(booking.total_amount || 0).toLocaleString('ar-IQ')} دينار عراقي`,
  ].join('\n');
}

function mapTemplate(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    owner_id: row.owner_id != null ? String(row.owner_id) : null,
    ownerId: row.owner_id != null ? String(row.owner_id) : null,
    title: String(row.title || ''),
    name: String(row.title || ''),
    body_text: String(row.body_text || ''),
    bodyText: String(row.body_text || ''),
    terms: String(row.body_text || ''),
    is_active: Boolean(row.is_active !== false),
    isActive: Boolean(row.is_active !== false),
    is_builtin: false,
    created_at: row.created_at,
    createdAt: row.created_at,
  };
}

const BUILTIN_TEMPLATE = {
  id: 'rental_ar_v1',
  owner_id: null as string | null,
  ownerId: null as string | null,
  title: 'عقد إيجار معدات',
  name: 'عقد إيجار معدات',
  body_text: null as string | null,
  bodyText: null as string | null,
  terms: 'قالب عربي قياسي يُملأ من بيانات الحجز تلقائياً',
  is_active: true,
  isActive: true,
  is_builtin: true,
  type: 'rental',
};

function mapContract(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    booking_id: String(row.booking_id),
    bookingId: String(row.booking_id),
    customer_id: String(row.customer_id),
    customerId: String(row.customer_id),
    owner_id: String(row.owner_id),
    ownerId: String(row.owner_id),
    status: String(row.status),
    terms_text: String(row.terms_text || ''),
    terms: String(row.terms_text || ''),
    signed_at: row.signed_at || null,
    signedAt: row.signed_at || null,
    created_at: row.created_at,
    createdAt: row.created_at,
  };
}

async function loadBookingForContract(bookingId: string) {
  const result = await query(
    `
    SELECT b.id, b.customer_id, b.start_date, b.end_date, b.total_amount, b.status AS booking_status,
           e.id AS equipment_id, e.title AS equipment_title, e.owner_id,
           c.name AS customer_name, o.name AS owner_name
    FROM bookings b
    JOIN equipment e ON e.id = b.equipment_id
    JOIN users c ON c.id = b.customer_id
    JOIN users o ON o.id = e.owner_id
    WHERE b.id = $1
    LIMIT 1
    `,
    [bookingId]
  );
  return result.rows[0] as
    | {
        id: string;
        customer_id: string;
        owner_id: string;
        start_date: unknown;
        end_date: unknown;
        total_amount: number | string;
        booking_status: string;
        equipment_id: string;
        equipment_title: string;
        customer_name: string;
        owner_name: string;
      }
    | undefined;
}

export const contractsController = {
  /** Create (or return existing) contract from booking */
  async createContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const bookingId = String(req.body?.bookingId || req.body?.booking_id || '').trim();
      if (!bookingId) {
        return res.status(400).json({ error: 'bookingId مطلوب' });
      }

      const booking = await loadBookingForContract(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'الحجز غير موجود' });
      }

      const isParty =
        String(booking.customer_id) === String(userId) ||
        String(booking.owner_id) === String(userId) ||
        req.user?.role === 'admin';
      if (!isParty) {
        return res.status(403).json({ error: 'غير مصرح بإنشاء عقد لهذا الحجز' });
      }

      const existing = await query(`SELECT * FROM digital_contracts WHERE booking_id = $1 LIMIT 1`, [
        bookingId,
      ]);
      if (existing.rows.length > 0) {
        return res.status(200).json(mapContract(existing.rows[0]));
      }

      const templateId = String(req.body?.template_id || req.body?.templateId || '').trim();
      let terms = buildArabicTerms(booking);
      if (templateId && templateId !== 'rental_ar_v1') {
        const tpl = await query(
          `
          SELECT * FROM contract_templates
          WHERE id = $1 AND is_active = true
            AND (owner_id IS NULL OR owner_id = $2 OR $3::boolean)
          LIMIT 1
          `,
          [templateId, booking.owner_id, req.user?.role === 'admin']
        );
        if (tpl.rows.length === 0) {
          return res.status(404).json({ error: 'قالب العقد غير موجود أو غير متاح' });
        }
        terms = fillTemplateBody(String(tpl.rows[0].body_text || ''), booking);
      }

      const inserted = await query(
        `
        INSERT INTO digital_contracts (booking_id, customer_id, owner_id, status, terms_text)
        VALUES ($1, $2, $3, 'sent', $4)
        RETURNING *
        `,
        [bookingId, booking.customer_id, booking.owner_id, terms]
      );

      const contract = mapContract(inserted.rows[0]);

      await notifications.sendNotification({
        userId: booking.customer_id,
        type: 'system',
        title: 'عقد الإيجار جاهز للتوقيع',
        message: `عقد إيجار المعدة «${booking.equipment_title}» جاهز. راجع الشروط ووقّع إلكترونياً.`,
        data: { related_id: bookingId, contractId: contract.id },
      });

      return res.status(201).json(contract);
    } catch (error) {
      console.error('createContract', error);
      return res.status(500).json({ error: 'فشل إنشاء العقد' });
    }
  },

  /** Get by contract id */
  async getContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const { id } = req.params;
      const result = await query(`SELECT * FROM digital_contracts WHERE id = $1 LIMIT 1`, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'العقد غير موجود' });
      }
      const row = result.rows[0];
      const isParty =
        String(row.customer_id) === String(userId) ||
        String(row.owner_id) === String(userId) ||
        req.user?.role === 'admin';
      if (!isParty) {
        return res.status(403).json({ error: 'غير مصرح بعرض هذا العقد' });
      }
      return res.json(mapContract(row));
    } catch (error) {
      console.error('getContract', error);
      return res.status(500).json({ error: 'فشل جلب العقد' });
    }
  },

  /** Get (or create) by booking id */
  async getByBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const bookingId = String(req.params.bookingId || '').trim();
      if (!bookingId) return res.status(400).json({ error: 'bookingId مطلوب' });

      const existing = await query(`SELECT * FROM digital_contracts WHERE booking_id = $1 LIMIT 1`, [
        bookingId,
      ]);
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const isParty =
          String(row.customer_id) === String(userId) ||
          String(row.owner_id) === String(userId) ||
          req.user?.role === 'admin';
        if (!isParty) return res.status(403).json({ error: 'غير مصرح' });
        return res.json(mapContract(row));
      }

      // Create on demand
      req.body = { ...(req.body || {}), bookingId };
      return contractsController.createContract(req, res);
    } catch (error) {
      console.error('getByBooking', error);
      return res.status(500).json({ error: 'فشل جلب عقد الحجز' });
    }
  },

  async signContract(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });

      const id = String(req.params.id || req.body?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'معرّف العقد مطلوب' });

      const result = await query(`SELECT * FROM digital_contracts WHERE id = $1 LIMIT 1`, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'العقد غير موجود' });
      }
      const row = result.rows[0];

      if (String(row.customer_id) !== String(userId) && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'التوقيع متاح للمستأجر فقط' });
      }
      if (row.status === 'signed') {
        return res.json(mapContract(row));
      }
      if (row.status === 'cancelled') {
        return res.status(400).json({ error: 'العقد ملغى ولا يمكن توقيعه' });
      }

      const updated = await query(
        `
        UPDATE digital_contracts
        SET status = 'signed', signed_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [id]
      );
      const contract = mapContract(updated.rows[0]);

      await notifications.sendNotification({
        userId: String(row.owner_id),
        type: 'system',
        title: 'تم توقيع عقد الإيجار',
        message: 'قام المستأجر بتوقيع عقد الإيجار إلكترونياً.',
        data: { related_id: String(row.booking_id), contractId: contract.id },
      });

      return res.json(contract);
    } catch (error) {
      console.error('signContract', error);
      return res.status(500).json({ error: 'فشل توقيع العقد' });
    }
  },

  async getContractStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await query(
        `SELECT id, status, signed_at, created_at FROM digital_contracts WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'العقد غير موجود' });
      }
      const row = result.rows[0];
      return res.json({
        id: row.id,
        status: row.status,
        signedAt: row.signed_at,
        createdAt: row.created_at,
      });
    } catch (error) {
      return res.status(500).json({ error: 'فشل جلب حالة العقد' });
    }
  },

  async updateContract(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin' && req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      const status = String(req.body?.status || '').trim();
      if (!['draft', 'sent', 'signed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'حالة غير صالحة' });
      }
      const updated = await query(
        `UPDATE digital_contracts SET status = $1 WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
      if (updated.rows.length === 0) return res.status(404).json({ error: 'العقد غير موجود' });
      return res.json(mapContract(updated.rows[0]));
    } catch (error) {
      return res.status(500).json({ error: 'فشل تحديث العقد' });
    }
  },

  async deleteContract(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      await query(`UPDATE digital_contracts SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
      return res.json({ message: 'تم إلغاء العقد' });
    } catch (error) {
      return res.status(500).json({ error: 'فشل إلغاء العقد' });
    }
  },

  async verifyContract(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await query(`SELECT id, status, signed_at FROM digital_contracts WHERE id = $1`, [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'العقد غير موجود' });
      }
      const row = result.rows[0];
      return res.json({
        isValid: row.status === 'signed',
        status: row.status,
        verifiedAt: new Date().toISOString(),
        signedAt: row.signed_at,
      });
    } catch (error) {
      return res.status(500).json({ error: 'فشل التحقق من العقد' });
    }
  },

  async getContractTemplates(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
      const role = req.user?.role;

      let result;
      if (role === 'admin') {
        result = await query(
          `SELECT * FROM contract_templates WHERE is_active = true ORDER BY created_at DESC`
        );
      } else {
        result = await query(
          `
          SELECT * FROM contract_templates
          WHERE is_active = true AND (owner_id IS NULL OR owner_id = $1)
          ORDER BY created_at DESC
          `,
          [userId]
        );
      }

      return res.json([BUILTIN_TEMPLATE, ...result.rows.map((r) => mapTemplate(r))]);
    } catch (error) {
      console.error('getContractTemplates', error);
      return res.status(500).json({ error: 'فشل جلب قوالب العقود' });
    }
  },

  async createContractTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = uid(req);
      const role = req.user?.role;
      if (!userId) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
      if (role !== 'admin' && role !== 'owner') {
        return res.status(403).json({ error: 'إنشاء القوالب للإدارة أو الشريك فقط' });
      }

      const title = String(req.body?.title || req.body?.name || '')
        .trim()
        .slice(0, 200);
      const bodyText = String(
        req.body?.body_text || req.body?.bodyText || req.body?.body || req.body?.terms || ''
      )
        .trim()
        .slice(0, 50000);
      if (!title || !bodyText) {
        return res.status(400).json({ error: 'العنوان ونص القالب مطلوبان' });
      }

      // Admin → platform template (owner_id null); owner → own template
      const ownerId = role === 'admin' ? null : userId;

      const inserted = await query(
        `
        INSERT INTO contract_templates (owner_id, title, body_text, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING *
        `,
        [ownerId, title, bodyText]
      );

      return res.status(201).json(mapTemplate(inserted.rows[0]));
    } catch (error) {
      console.error('createContractTemplate', error);
      return res.status(500).json({ error: 'فشل إنشاء قالب العقد' });
    }
  },

  async getContractAnalytics(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'signed')::int AS signed,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM digital_contracts
      `);
      const r = result.rows[0] || {};
      return res.json({
        totalContracts: Number(r.total || 0),
        signedContracts: Number(r.signed || 0),
        sentContracts: Number(r.sent || 0),
        draftContracts: Number(r.draft || 0),
        cancelledContracts: Number(r.cancelled || 0),
      });
    } catch (error) {
      return res.status(500).json({ error: 'فشل إحصائيات العقود' });
    }
  },
};
