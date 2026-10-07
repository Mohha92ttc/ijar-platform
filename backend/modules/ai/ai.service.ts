import { query } from '../../database/connection';

/**
 * Popularity / search heuristics (not ML).
 * Labeled as «توصيات» based on ratings and booking counts.
 */
export class AIService {
  async getRecommendations(userId?: string, limit = 8) {
    const lim = Math.min(Math.max(Number(limit) || 8, 1), 24);

    // Prefer categories the user previously booked when userId is present
    let categoryBoost: string | null = null;
    if (userId) {
      const pref = await query(
        `
        SELECT e.category, COUNT(*)::int AS cnt
        FROM bookings b
        JOIN equipment e ON e.id = b.equipment_id
        WHERE b.customer_id = $1
        GROUP BY e.category
        ORDER BY cnt DESC
        LIMIT 1
        `,
        [userId]
      );
      if (pref.rows[0]?.category) {
        categoryBoost = String(pref.rows[0].category);
      }
    }

    const params: unknown[] = [];
    let orderExtra = '';
    if (categoryBoost) {
      params.push(categoryBoost);
      orderExtra = `CASE WHEN e.category = $1 THEN 0 ELSE 1 END,`;
    }
    params.push(lim);
    const limitParam = `$${params.length}`;

    const result = await query(
      `
      SELECT
        e.id,
        e.title,
        e.category,
        e.price_per_day,
        e.location,
        e.average_rating,
        e.review_count,
        e.images,
        COALESCE(bc.booking_count, 0)::int AS booking_count,
        u.name AS owner_name
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      LEFT JOIN (
        SELECT equipment_id, COUNT(*)::int AS booking_count
        FROM bookings
        WHERE status IN ('confirmed', 'completed')
        GROUP BY equipment_id
      ) bc ON bc.equipment_id = e.id
      WHERE e.status = 'available'
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      ORDER BY
        ${orderExtra}
        COALESCE(e.average_rating, 0) DESC,
        COALESCE(bc.booking_count, 0) DESC,
        e.created_at DESC
      LIMIT ${limitParam}
      `,
      params
    );

    return {
      label: 'توصيات',
      source: 'popularity',
      note: 'ترتيب حسب التقييم وعدد الحجوزات (وليست نماذج تعلّم آلة)',
      items: result.rows.map((row) => ({
        id: String(row.id),
        equipmentId: String(row.id),
        equipmentName: String(row.title),
        category: String(row.category),
        price: Number(row.price_per_day || 0),
        location: String(row.location || ''),
        rating: Number(row.average_rating || 0),
        reviewCount: Number(row.review_count || 0),
        bookingCount: Number(row.booking_count || 0),
        imageUrl: Array.isArray(row.images) && row.images[0] ? String(row.images[0]) : null,
        ownerName: String(row.owner_name || ''),
        reason: categoryBoost && row.category === categoryBoost
          ? 'شائع في فئة حجوزاتك السابقة'
          : 'الأعلى تقييماً / الأكثر حجزاً',
      })),
    };
  }

  async searchAssist(searchQuery: string, limit = 20) {
    const q = String(searchQuery || '').trim();
    if (!q) {
      return { label: 'بحث', query: q, results: [], total: 0 };
    }

    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const like = `%${q}%`;

    const result = await query(
      `
      SELECT
        e.id,
        e.title,
        e.description,
        e.category,
        e.price_per_day,
        e.location,
        e.average_rating,
        e.status,
        u.name AS owner_name
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      WHERE e.status NOT IN ('hidden')
        AND (
          e.title ILIKE $1
          OR e.description ILIKE $1
          OR e.category ILIKE $1
          OR e.location ILIKE $1
        )
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      ORDER BY e.average_rating DESC NULLS LAST, e.created_at DESC
      LIMIT $2
      `,
      [like, lim]
    );

    return {
      label: 'بحث',
      query: q,
      total: result.rows.length,
      results: result.rows.map((row) => ({
        id: String(row.id),
        name: String(row.title),
        description: String(row.description || '').slice(0, 200),
        category: String(row.category),
        price: Number(row.price_per_day || 0),
        rating: Number(row.average_rating || 0),
        location: String(row.location || ''),
        availability: String(row.status) === 'available',
        ownerName: String(row.owner_name || ''),
      })),
    };
  }

  /** Simple demand proxy: booking counts by category */
  async predictEquipmentDemand(_timeRange?: string, equipmentCategory?: string) {
    const params: unknown[] = [];
    let where = `WHERE b.status IN ('confirmed', 'completed') AND b.created_at > NOW() - INTERVAL '90 days'`;
    if (equipmentCategory) {
      params.push(equipmentCategory);
      where += ` AND e.category = $${params.length}`;
    }
    const result = await query(
      `
      SELECT e.category, COUNT(*)::int AS bookings
      FROM bookings b
      JOIN equipment e ON e.id = b.equipment_id
      ${where}
      GROUP BY e.category
      ORDER BY bookings DESC
      LIMIT 20
      `,
      params
    );
    return {
      label: 'إحصاء طلب',
      source: 'bookings_90d',
      categories: result.rows.map((r) => ({
        category: String(r.category),
        bookings: Number(r.bookings || 0),
      })),
    };
  }

  async predictCustomerChurn(_timeRange?: string) {
    const result = await query(`
      SELECT COUNT(DISTINCT customer_id)::int AS inactive_customers
      FROM bookings
      WHERE created_at < NOW() - INTERVAL '90 days'
        AND customer_id NOT IN (
          SELECT DISTINCT customer_id FROM bookings WHERE created_at >= NOW() - INTERVAL '90 days'
        )
    `);
    return {
      label: 'عملاء بلا حجوزات حديثة',
      source: 'bookings_gap_90d',
      inactiveCustomers: Number(result.rows[0]?.inactive_customers || 0),
      note: 'عدد تقريبي لمن لم يحجزوا خلال 90 يوماً بعد نشاط سابق',
    };
  }

  async predictRevenue(_timeRange?: string) {
    const result = await query(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::float AS last_30d,
        COALESCE(SUM(total_amount) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days'), 0)::float AS last_90d
      FROM bookings
      WHERE status IN ('confirmed', 'completed')
    `);
    const r = result.rows[0] || {};
    return {
      label: 'إيرادات فعلية',
      source: 'bookings',
      last30Days: Number(r.last_30d || 0),
      last90Days: Number(r.last_90d || 0),
      note: 'مجموع مبالغ الحجوزات المؤكدة/المكتملة — ليس توقعاً تنبؤياً',
    };
  }

  async analyzeSentiment() {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        AVG(rating)::float AS avg_rating,
        COUNT(*) FILTER (WHERE rating >= 4)::int AS positive,
        COUNT(*) FILTER (WHERE rating = 3)::int AS neutral,
        COUNT(*) FILTER (WHERE rating <= 2)::int AS negative
      FROM reviews
    `);
    const r = result.rows[0] || {};
    const total = Number(r.total || 0) || 1;
    return {
      label: 'ملخص التقييمات',
      source: 'reviews',
      averageRating: Number(r.avg_rating || 0),
      total: Number(r.total || 0),
      breakdown: {
        positive: Number(r.positive || 0) / total,
        neutral: Number(r.neutral || 0) / total,
        negative: Number(r.negative || 0) / total,
      },
    };
  }

  async optimizePricing() {
    const result = await query(`
      SELECT
        e.id,
        e.title,
        e.price_per_day,
        COALESCE(e.average_rating, 0)::float AS rating,
        COALESCE(bc.cnt, 0)::int AS bookings
      FROM equipment e
      LEFT JOIN (
        SELECT equipment_id, COUNT(*)::int AS cnt
        FROM bookings WHERE status IN ('confirmed', 'completed')
        GROUP BY equipment_id
      ) bc ON bc.equipment_id = e.id
      WHERE e.status = 'available'
      ORDER BY bc.cnt DESC NULLS LAST
      LIMIT 15
    `);
    return {
      label: 'ملاحظات تسعير',
      source: 'popularity',
      recommendations: result.rows.map((row) => {
        const price = Number(row.price_per_day || 0);
        const bookings = Number(row.bookings || 0);
        const suggested =
          bookings >= 5 && Number(row.rating) >= 4 ? Math.round(price * 1.05) : price;
        return {
          equipmentId: String(row.id),
          title: String(row.title),
          currentPrice: price,
          suggestedPrice: suggested,
          bookingCount: bookings,
          reasoning:
            suggested > price
              ? 'طلب مرتفع وتقييم جيد — زيادة طفيفة محتملة'
              : 'الإبقاء على السعر الحالي',
        };
      }),
    };
  }

  async findBestEquipmentMatch(requirements: { category?: string; maxPrice?: number } = {}) {
    const params: unknown[] = [];
    const where: string[] = [`e.status = 'available'`];
    if (requirements.category) {
      params.push(requirements.category);
      where.push(`e.category ILIKE $${params.length}`);
    }
    if (requirements.maxPrice != null && Number.isFinite(Number(requirements.maxPrice))) {
      params.push(Number(requirements.maxPrice));
      where.push(`e.price_per_day <= $${params.length}`);
    }
    params.push(5);
    const result = await query(
      `
      SELECT e.id, e.title, e.category, e.price_per_day, e.average_rating, e.location
      FROM equipment e
      JOIN users u ON u.id = e.owner_id
      WHERE ${where.join(' AND ')}
        AND u.subscription_status = 'active'
        AND u.subscription_end_date IS NOT NULL
        AND u.subscription_end_date > NOW()
      ORDER BY e.average_rating DESC NULLS LAST, e.created_at DESC
      LIMIT $${params.length}
      `,
      params
    );
    const rows = result.rows;
    return {
      label: 'مطابقة معدات',
      bestMatch: rows[0]
        ? {
            equipmentId: String(rows[0].id),
            name: String(rows[0].title),
            price: Number(rows[0].price_per_day || 0),
            rating: Number(rows[0].average_rating || 0),
          }
        : null,
      alternatives: rows.slice(1).map((r) => ({
        equipmentId: String(r.id),
        name: String(r.title),
        price: Number(r.price_per_day || 0),
        rating: Number(r.average_rating || 0),
      })),
    };
  }

  async generatePersonalizedContent(userId?: string) {
    const rec = await this.getRecommendations(userId, 5);
    return {
      label: 'توصيات',
      recommendations: rec.items.map((i) => ({
        type: 'equipment',
        title: i.equipmentName,
        equipmentId: i.equipmentId,
        reason: i.reason,
      })),
    };
  }

  async getAnalyticsOverview() {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM equipment WHERE status = 'available') AS active_equipment,
        (SELECT COUNT(*)::int FROM bookings) AS total_bookings,
        (SELECT COALESCE(SUM(total_amount), 0)::float FROM bookings WHERE status IN ('confirmed','completed')) AS revenue
    `);
    const r = result.rows[0] || {};
    return {
      label: 'نظرة عامة',
      source: 'database',
      totalUsers: Number(r.total_users || 0),
      activeEquipment: Number(r.active_equipment || 0),
      totalBookings: Number(r.total_bookings || 0),
      revenue: Number(r.revenue || 0),
    };
  }

  async getUserBehaviorAnalytics() {
    const result = await query(`
      SELECT e.category, COUNT(*)::int AS bookings
      FROM bookings b
      JOIN equipment e ON e.id = b.equipment_id
      WHERE b.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY e.category
      ORDER BY bookings DESC
      LIMIT 10
    `);
    return {
      label: 'سلوك الحجوزات',
      preferredCategories: result.rows.map((r) => ({
        category: String(r.category),
        bookings: Number(r.bookings || 0),
      })),
    };
  }

  async getMarketTrends() {
    const result = await query(`
      SELECT
        date_trunc('month', created_at)::date AS month,
        COUNT(*)::int AS bookings,
        COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM bookings
      WHERE created_at >= NOW() - INTERVAL '6 months'
        AND status IN ('confirmed', 'completed')
      GROUP BY 1
      ORDER BY 1
    `);
    return {
      label: 'اتجاه الحجوزات',
      source: 'bookings_6m',
      months: result.rows.map((r) => ({
        month: r.month,
        bookings: Number(r.bookings || 0),
        revenue: Number(r.revenue || 0),
      })),
    };
  }
}

export const aiService = new AIService();
