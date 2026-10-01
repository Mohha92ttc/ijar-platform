import { query } from '../database/connection';
import { mailService } from './mail.service';
import { checkStorageHealth, getStorageMode } from './upload.service';

export type ReadinessCheck = {
  name: string;
  ok: boolean;
  required: boolean;
  detail?: string;
};

export type ReadinessReport = {
  ready: boolean;
  environment: string;
  checks: ReadinessCheck[];
  score: number;
};

/**
 * Production readiness self-check (admin / ops).
 * Score 100 when all required checks pass and optional payment/mail/storage are healthy.
 */
export async function getReadinessReport(): Promise<ReadinessReport> {
  const isProd = process.env.NODE_ENV === 'production';
  const checks: ReadinessCheck[] = [];

  // JWT
  const secret = process.env.JWT_SECRET || '';
  checks.push({
    name: 'jwt_secret',
    required: true,
    ok: secret.length >= 32 && !/^(change-me|secret|jwt_secret|placeholder|your-)/i.test(secret),
    detail: secret.length >= 32 ? 'configured' : `length=${secret.length}`,
  });

  // CORS
  checks.push({
    name: 'allowed_origins',
    required: isProd,
    ok: !isProd || Boolean(process.env.ALLOWED_ORIGINS?.trim()),
    detail: process.env.ALLOWED_ORIGINS || 'unset (dev localhost ok)',
  });

  // DB
  try {
    await query('SELECT 1');
    checks.push({ name: 'database', required: true, ok: true });
  } catch (e) {
    checks.push({
      name: 'database',
      required: true,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // SMTP / email
  let smtpDetail = 'dev log-only mailer (set SMTP_* for production)';
  let smtpHealthy = !isProd;
  if (mailService.isConfigured()) {
    const verified = await mailService.verifyConnection();
    smtpHealthy = verified;
    smtpDetail = verified ? 'SMTP configured + verified' : 'SMTP configured but connection failed';
  }
  checks.push({
    name: 'smtp',
    required: isProd,
    ok: isProd ? smtpHealthy : true,
    detail: smtpDetail,
  });

  // Storage
  const storage = await checkStorageHealth();
  const storageRequired = isProd && process.env.REQUIRE_OBJECT_STORAGE === 'true';
  checks.push({
    name: 'object_storage',
    required: storageRequired,
    ok: storage.ok && (!storageRequired || getStorageMode() === 's3'),
    detail: storage.ok
      ? `mode=${storage.mode}`
      : `mode=${storage.mode} error=${storage.detail}`,
  });

  // Stripe (optional — manual transfer is primary fallback)
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const stripeOk = stripeKey.startsWith('sk_');
  const webhookOk = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  checks.push({
    name: 'stripe',
    required: false,
    ok: true,
    detail: stripeOk
      ? webhookOk
        ? 'Stripe + webhook ready'
        : 'Stripe key set (add STRIPE_WEBHOOK_SECRET for auto-confirm)'
      : 'manual bank transfer only',
  });

  // Mock auth must be off
  checks.push({
    name: 'mock_auth_disabled',
    required: true,
    ok: process.env.ENABLE_MOCK_AUTH !== 'true' || !isProd,
    detail: process.env.ENABLE_MOCK_AUTH === 'true' ? 'ENABLE_MOCK_AUTH=true' : 'disabled',
  });

  // Backup script
  checks.push({
    name: 'backup_script',
    required: false,
    ok: true,
    detail: 'npm run backup (scripts/backup.mjs)',
  });

  const requiredFailed = checks.filter((c) => c.required && !c.ok).length;
  const optionalFailed = checks.filter((c) => !c.required && !c.ok).length;
  const ready = requiredFailed === 0;
  const score = Math.max(0, 100 - requiredFailed * 12 - optionalFailed * 4);

  return {
    ready,
    environment: process.env.NODE_ENV || 'development',
    checks,
    score: ready && optionalFailed === 0 ? 100 : score,
  };
}
