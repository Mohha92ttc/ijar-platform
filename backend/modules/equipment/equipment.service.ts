import { query } from '../../database/connection';
import { Equipment, CreateEquipmentDTO, UpdateEquipmentDTO, EquipmentSearchFilters } from './equipment.types';
import { assertOwnerSubscriptionActive, syncExpiredSubscriptions } from '../subscriptions/subscription.policy';

function formatLoc(governorate?: string | null, area?: string | null, fallback = ''): string {
  const g = String(governorate || '').trim();
  const a = String(area || '').trim();
  if (g && a) return `${g} - ${a}`;
  if (g) return g;
  if (a) return a;
  return fallback;
}

function rowToEquipment(row: Record<string, unknown>): Equipment {
  const governorate = row.governorate != null ? String(row.governorate) : null;
  const area = row.area != null && String(row.area) !== '' ? String(row.area) : null;
  const locationRaw = String(row.location || '');
  const base: Equipment = {
    id: String(row.id),
    owner_id: String(row.owner_id),
    title: String(row.title),
    description: String(row.description),
    category: String(row.category),
    price_per_day: Number(row.price_per_day),
    quantity: Math.max(1, Math.min(100000, Math.floor(Number(row.quantity ?? 1) || 1))),
    location: locationRaw || formatLoc(governorate, area),
    governorate,
    area,
    pickup_lat:
      row.pickup_lat != null && Number.isFinite(Number(row.pickup_lat)) ? Number(row.pickup_lat) : null,
    pickup_lng:
      row.pickup_lng != null && Number.isFinite(Number(row.pickup_lng)) ? Number(row.pickup_lng) : null,
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    status: row.status as Equipment['status'],
    average_rating: Number(row.average_rating ?? 0),
    review_count: Number(row.review_count ?? 0),
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
  if (row.owner_is_featured !== undefined) {
    base.owner_is_featured = Boolean(row.owner_is_featured);
  }
  if (row.owner_name !== undefined && row.owner_name !== null) {
    base.owner_name = String(row.owner_name);
  }
  return base;
}

export class EquipmentService {
  async create(ownerId: string, data: CreateEquipmentDTO): Promise<Equipment> {
    await assertOwnerSubscriptionActive(ownerId);
    const { saveProofImage } = await import('../../services/upload.service');
    const imgsRaw = data.images && data.images.length > 0 ? data.images : [];
    const imgs: string[] = [];
    for (const img of imgsRaw.slice(0, 5)) {
      const s = String(img || '');
      if (!s) continue;
      if (s.startsWith('data:')) {
        imgs.push(await saveProofImage(s, 'equipment'));
      } else {
        imgs.push(s);
      }
    }
    const governorate = String(data.governorate || '').trim() || String(data.location || '').split('-')[0].trim() || 'بغداد';
    const area = data.area != null && String(data.area).trim() !== '' ? String(data.area).trim() : null;
    const location = formatLoc(governorate, area, data.location || governorate);
    const pickupLat =
      data.pickup_lat != null && Number.isFinite(Number(data.pickup_lat)) ? Number(data.pickup_lat) : null;
    const pickupLng =
      data.pickup_lng != null && Number.isFinite(Number(data.pickup_lng)) ? Number(data.pickup_lng) : null;
    const quantity = Math.max(1, Math.min(100000, Math.floor(Number(data.quantity ?? 1) || 1)));
    const sql = `
      INSERT INTO equipment (owner_id, title, description, category, price_per_day, quantity, location, governorate, area, pickup_lat, pickup_lng, images, status, average_rating, review_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available', 0, 0)
      RETURNING *
    `;
    const res = await query(sql, [
      ownerId,
      data.title,
      data.description,
      data.category,
      data.price_per_day,
      quantity,
      location,
      governorate,
      area,
      pickupLat,
      pickupLng,
      imgs,
    ]);
    return rowToEquipment(res.rows[0]);
  }

  async update(id: string, ownerId: string, data: UpdateEquipmentDTO): Promise<Equipment> {
    await assertOwnerSubscriptionActive(ownerId);
    const existing = await this.getById(id);
    if (existing.owner_id !== ownerId) {
      throw new Error('Equipment not found or unauthorized');
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (data.title !== undefined) {
      fields.push(`title = $${i++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(data.description);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${i++}`);
      values.push(data.category);
    }
    if (data.price_per_day !== undefined) {
      fields.push(`price_per_day = $${i++}`);
      values.push(data.price_per_day);
    }
    if (data.quantity !== undefined) {
      const nextQty = Math.max(1, Math.min(100000, Math.floor(Number(data.quantity) || 1)));
      // Floor: active bookings count (conservative — never below committed rentals)
      const activeRes = await query(
        `
        SELECT COUNT(*)::int AS cnt
        FROM bookings
        WHERE equipment_id = $1 AND status IN ('pending', 'confirmed')
        `,
        [id]
      );
      const active = Number(activeRes.rows[0]?.cnt || 0);
      if (active > 0 && nextQty < active) {
        throw new Error(
          `لا يمكن تقليل الكمية إلى ${nextQty}: لديك ${active} حجوزات نشطة على هذه المعدة`
        );
      }
      fields.push(`quantity = $${i++}`);
      values.push(nextQty);
    }
    if (data.location !== undefined) {
      fields.push(`location = $${i++}`);
      values.push(data.location);
    }
    if (data.governorate !== undefined) {
      fields.push(`governorate = $${i++}`);
      values.push(data.governorate);
    }
    if (data.area !== undefined) {
      fields.push(`area = $${i++}`);
      values.push(data.area);
    }
    if (data.pickup_lat !== undefined) {
      fields.push(`pickup_lat = $${i++}`);
      values.push(
        data.pickup_lat != null && Number.isFinite(Number(data.pickup_lat)) ? Number(data.pickup_lat) : null
      );
    }
    if (data.pickup_lng !== undefined) {
      fields.push(`pickup_lng = $${i++}`);
      values.push(
        data.pickup_lng != null && Number.isFinite(Number(data.pickup_lng)) ? Number(data.pickup_lng) : null
      );
    }
    if (data.images !== undefined) {
      const { saveProofImage } = await import('../../services/upload.service');
      const imgs: string[] = [];
      for (const img of (data.images || []).slice(0, 5)) {
        const s = String(img || '');
        if (!s) continue;
        if (s.startsWith('data:')) {
          imgs.push(await saveProofImage(s, 'equipment'));
        } else {
          imgs.push(s);
        }
      }
      fields.push(`images = $${i++}`);
      values.push(imgs);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${i++}::equipment_status`);
      values.push(data.status);
    }
    if (fields.length === 0) return existing;
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const sql = `UPDATE equipment SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const res = await query(sql, values);
    return rowToEquipment(res.rows[0]);
  }

  async delete(id: string, ownerId: string): Promise<void> {
    await assertOwnerSubscriptionActive(ownerId);
    const active = await query(
      `
      SELECT COUNT(*)::int AS n
      FROM bookings
      WHERE equipment_id = $1 AND status IN ('pending', 'confirmed')
      `,
      [id]
    );
    if (Number(active.rows[0]?.n || 0) > 0) {
      throw new Error('لا يمكن حذف المعدة وفيها حجوزات قائمة أو مؤكدة. أكملها أو ألغِها أولاً، أو أخفِ المعدة.');
    }
    const res = await query(`DELETE FROM equipment WHERE id = $1 AND owner_id = $2`, [id, ownerId]);
    if (res.rowCount === 0) {
      throw new Error('Equipment not found or unauthorized');
    }
  }

  async getById(id: string, opts?: { requirePublicOwner?: boolean }): Promise<Equipment> {
    const res = await query(
      opts?.requirePublicOwner
        ? `
      SELECT e.*,
        u.name AS owner_name,
        (u.featured_until IS NOT NULL AND u.featured_until > NOW()) AS owner_is_featured
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      WHERE e.id = $1
        AND e.status NOT IN ('hidden', 'maintenance')
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      `
        : `SELECT * FROM equipment WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) {
      throw new Error('Equipment not found');
    }
    return rowToEquipment(res.rows[0]);
  }

  async getAll(): Promise<Equipment[]> {
    await syncExpiredSubscriptions();
    const res = await query(
      `
      SELECT e.*,
        u.name AS owner_name,
        (u.featured_until IS NOT NULL AND u.featured_until > NOW()) AS owner_is_featured
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      WHERE e.status NOT IN ('hidden', 'maintenance')
        AND u.role = 'owner'
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      ORDER BY
        CASE WHEN u.featured_until IS NOT NULL AND u.featured_until > NOW() THEN 0 ELSE 1 END,
        COALESCE(u.featured_priority, 0) DESC,
        e.created_at DESC
      `
    );
    return res.rows.map(rowToEquipment);
  }

  /** شركاء لديهم معدات ظاهرة — للبحث وصفحة المتجر */
  async listPublicPartners(): Promise<
    { id: string; name: string; equipment_count: number; locations: string[]; featured: boolean }[]
  > {
    const res = await query(
      `
      SELECT
        u.id,
        u.name,
        COUNT(e.id)::int AS equipment_count,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(NULLIF(TRIM(e.governorate), ''), NULLIF(TRIM(SPLIT_PART(e.location, '-', 1)), ''))), NULL) AS locations,
        BOOL_OR(u.featured_until IS NOT NULL AND u.featured_until > NOW()) AS featured
      FROM users u
      JOIN equipment e ON e.owner_id = u.id AND e.status NOT IN ('hidden', 'maintenance')
      WHERE u.role = 'owner'
        AND COALESCE(u.is_approved, true) = true
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      GROUP BY u.id, u.name
      ORDER BY featured DESC, equipment_count DESC, u.name ASC
      `
    );
    return res.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name || 'شريك'),
      equipment_count: Number(row.equipment_count || 0),
      locations: Array.isArray(row.locations) ? (row.locations as string[]).filter(Boolean) : [],
      featured: Boolean(row.featured),
    }));
  }

  async search(filters: EquipmentSearchFilters): Promise<Equipment[]> {
    let sql = `
      SELECT e.*,
        u.name AS owner_name,
        (u.featured_until IS NOT NULL AND u.featured_until > NOW()) AS owner_is_featured
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      WHERE e.status NOT IN ('hidden', 'maintenance')
        AND u.role = 'owner'
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
    `;
    const params: unknown[] = [];
    let n = 1;

    if (filters.query) {
      sql += ` AND (e.title ILIKE $${n} OR e.description ILIKE $${n} OR u.name ILIKE $${n} OR e.location ILIKE $${n})`;
      params.push(`%${filters.query}%`);
      n++;
    }
    if (filters.category) {
      sql += ` AND e.category ILIKE $${n}`;
      params.push(filters.category);
      n++;
    }
    if (filters.location) {
      sql += ` AND e.location ILIKE $${n}`;
      params.push(`%${filters.location}%`);
      n++;
    }
    if (filters.governorate) {
      sql += ` AND (COALESCE(e.governorate, '') ILIKE $${n} OR e.location ILIKE $${n})`;
      params.push(`%${filters.governorate}%`);
      n++;
    }
    if (filters.area) {
      sql += ` AND (COALESCE(e.area, '') ILIKE $${n} OR e.location ILIKE $${n})`;
      params.push(`%${filters.area}%`);
      n++;
    }
    if (filters.minPrice !== undefined) {
      sql += ` AND e.price_per_day >= $${n}`;
      params.push(filters.minPrice);
      n++;
    }
    if (filters.maxPrice !== undefined) {
      sql += ` AND e.price_per_day <= $${n}`;
      params.push(filters.maxPrice);
      n++;
    }
    if (filters.minRating !== undefined) {
      sql += ` AND e.average_rating >= $${n}`;
      params.push(filters.minRating);
      n++;
    }

    sql += `
      ORDER BY
        CASE WHEN u.featured_until IS NOT NULL AND u.featured_until > NOW() THEN 0 ELSE 1 END,
        COALESCE(u.featured_priority, 0) DESC,
        e.created_at DESC
    `;
    const res = await query(sql, params);
    const list = res.rows.map(rowToEquipment);

    if (!filters.startDate || !filters.endDate) {
      return list;
    }

    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const filtered: Equipment[] = [];
    for (const e of list) {
      const ok = await this.isAvailableForRange(e.id, start, end);
      if (ok) filtered.push(e);
    }
    return filtered;
  }

  /** Still has stock for the range (overlapping bookings < quantity) */
  private async isAvailableForRange(equipmentId: string, start: Date, end: Date): Promise<boolean> {
    const qtyRes = await query(
      `SELECT COALESCE(quantity, 1)::int AS quantity FROM equipment WHERE id = $1 LIMIT 1`,
      [equipmentId]
    );
    const quantity = Math.max(1, Number(qtyRes.rows[0]?.quantity) || 1);
    const res = await query(
      `
      SELECT COUNT(*)::int AS cnt FROM bookings
      WHERE equipment_id = $1
        AND status IN ('pending', 'confirmed')
        AND start_date < $3 AND end_date > $2
    `,
      [equipmentId, start, end]
    );
    return Number(res.rows[0]?.cnt || 0) < quantity;
  }

  async getByOwner(ownerId: string): Promise<Equipment[]> {
    const res = await query(`SELECT * FROM equipment WHERE owner_id = $1 ORDER BY created_at DESC`, [ownerId]);
    return res.rows.map(rowToEquipment);
  }

  async getCategories(): Promise<any[]> {
    const res = await query(
      `
      SELECT c.*,
             COALESCE((
               SELECT COUNT(*)::int FROM equipment e
               JOIN users u ON u.id = e.owner_id
               WHERE e.category = c.name
                 AND e.status NOT IN ('hidden')
                 AND u.subscription_status = 'active'
                 AND u.subscription_end_date IS NOT NULL
                 AND u.subscription_end_date > NOW()
             ), 0) AS equipment_count
      FROM categories c
      WHERE c.is_active = TRUE
      ORDER BY c.sort_order ASC
      `
    );
    return res.rows;
  }

  async addCategory(name: string, image?: string): Promise<any> {
    const res = await query(
      'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *',
      [name, image]
    );
    return res.rows[0];
  }

  async deleteCategory(id: string): Promise<void> {
    await query('UPDATE categories SET is_active = FALSE WHERE id = $1', [id]);
  }
}
