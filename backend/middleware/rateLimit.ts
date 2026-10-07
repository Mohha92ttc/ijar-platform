import { Request, Response, NextFunction } from 'express';

type HitEntry = { count: number; resetAt: number };

/**
 * Simple in-memory IP rate limiter (per-process). Soft Arabic 429 on exceed.
 */
export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  message?: string;
}): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, HitEntry>();
  const message =
    opts.message ||
    'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل.';

  // Periodic cleanup to avoid unbounded growth
  const cleanupEvery = Math.max(opts.windowMs, 60_000);
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, cleanupEvery).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;

    if (entry.count > opts.max) {
      const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

/** 20 requests / 15 minutes — auth + public contact */
export const authSensitiveLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'محاولات كثيرة جداً. انتظر ربع ساعة ثم حاول مجدداً.',
});
