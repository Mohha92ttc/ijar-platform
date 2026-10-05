import { query } from '../../database/connection';

/** SQL fragment: owner alias `u` must be in scope. Active paid subscription only. */
export const OWNER_SUB_ACTIVE_SQL = `
  u.subscription_status = 'active'
  AND u.subscription_end_date IS NOT NULL
  AND u.subscription_end_date > NOW()
`;

export function isSubscriptionActiveRow(row: {
  subscription_status?: string | null;
  subscription_end_date?: string | Date | null;
}): boolean {
  if (String(row.subscription_status || '') !== 'active') return false;
  if (!row.subscription_end_date) return false;
  return new Date(row.subscription_end_date).getTime() > Date.now();
}

/** Mark past-due owners as expired (idempotent). */
export async function syncExpiredSubscriptions(userId?: string): Promise<void> {
  // Legacy: active without end date → grant 30-day grace once
  if (userId) {
    await query(
      `
      UPDATE users
      SET subscription_end_date = NOW() + INTERVAL '30 days'
      WHERE id = $1
        AND role = 'owner'
        AND subscription_status = 'active'
        AND subscription_end_date IS NULL
      `,
      [userId]
    );
    await query(
      `
      UPDATE users
      SET subscription_status = 'expired'
      WHERE id = $1
        AND role = 'owner'
        AND subscription_status = 'active'
        AND subscription_end_date IS NOT NULL
        AND subscription_end_date <= NOW()
      `,
      [userId]
    );
    return;
  }
  await query(
    `
    UPDATE users
    SET subscription_end_date = NOW() + INTERVAL '30 days'
    WHERE role = 'owner'
      AND subscription_status = 'active'
      AND subscription_end_date IS NULL
    `
  );
  await query(
    `
    UPDATE users
    SET subscription_status = 'expired'
    WHERE role = 'owner'
      AND subscription_status = 'active'
      AND subscription_end_date IS NOT NULL
      AND subscription_end_date <= NOW()
    `
  );
}

export async function assertOwnerSubscriptionActive(ownerId: string): Promise<void> {
  await syncExpiredSubscriptions(ownerId);
  const res = await query(
    `SELECT subscription_status, subscription_end_date FROM users WHERE id = $1 AND role = 'owner' LIMIT 1`,
    [ownerId]
  );
  if (res.rows.length === 0) {
    throw new Error('الشريك غير موجود');
  }
  if (!isSubscriptionActiveRow(res.rows[0])) {
    throw new Error(
      'اشتراكك غير مفعّل أو منتهٍ. جدّد الاشتراك من تبويب الدفع حتى تظهر معداتك وتعمل لوحة التحكم.'
    );
  }
}

/** Extend subscription from max(now, current end). */
export const SUBSCRIPTION_EXTEND_SQL = `
  subscription_end_date = GREATEST(COALESCE(subscription_end_date, NOW()), NOW()) + ($2::int * INTERVAL '1 month'),
  subscription_status = 'active',
  is_approved = TRUE
`;
