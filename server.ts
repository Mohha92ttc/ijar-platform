import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { authRoutes } from './backend/modules/auth';
import { equipmentRoutes } from './backend/modules/equipment';
import { bookingRoutes } from './backend/modules/bookings';
import { paymentRoutes } from './backend/modules/payments';
import { reviewRoutes } from './backend/modules/reviews';
import { notificationRoutes } from './backend/modules/notifications';
import adminRoutes from './admin/dashboard/admin.routes';
import platformRoutes from './backend/modules/platform/platform.routes';
import aiRoutes from './backend/modules/ai/ai.routes';
import contractsRoutes from './backend/modules/contracts/contracts.routes';
import insuranceRoutes from './backend/modules/insurance/insurance.routes';
import supportRoutes from './backend/modules/support/support.routes';
import referralRoutes from './backend/modules/referral/referral.routes';
import discountRoutes from './backend/modules/discounts/discounts.routes';
import { initializeDatabase } from './backend/database/connection';
import { MigrationService } from './backend/services/migration.service';
import { WebSocketService } from './backend/services/websocket.service';
import { authenticateToken, requireRole, AuthenticatedRequest } from './backend/modules/auth/auth.middleware';
import { ensureUploadDir, UPLOAD_DIR } from './backend/services/upload.service';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function checkRequiredEnv() {
  const required = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('CRITICAL: Missing required environment variables:', missing.join(', '));
    if (isProd) {
      throw new Error('Missing required environment variables in production');
    }
  }
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) {
    const msg = 'JWT_SECRET must be at least 32 characters';
    if (isProd) throw new Error(msg);
    console.warn(`WARNING: ${msg} (current length: ${secret.length})`);
  }
  if (/^(change-me|secret|jwt_secret|placeholder)/i.test(secret)) {
    const msg = 'JWT_SECRET looks like a placeholder — generate a strong random secret';
    if (isProd) throw new Error(msg);
    console.warn(`WARNING: ${msg}`);
  }
  if (isProd && !process.env.ALLOWED_ORIGINS) {
    throw new Error('ALLOWED_ORIGINS is required in production');
  }
  if (isProd && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
    throw new Error('SMTP_HOST/SMTP_USER/SMTP_PASS are required in production for real email');
  }
}

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '5173', 10);

  checkRequiredEnv();
  ensureUploadDir();

  const allowedOrigins = getAllowedOrigins();

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'ws:', 'wss:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) {
          if (!isProd && isLocalDevOrigin(origin)) return callback(null, true);
          return callback(new Error('CORS is not configured'), false);
        }
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'), false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());

  // Stripe webhook needs raw body — mount before JSON parser
  const { PaymentController } = await import('./backend/modules/payments/payment.controller');
  const paymentController = new PaymentController();
  app.post(
    '/api/payments/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => paymentController.stripeWebhook(req, res)
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded payment proofs / images from disk (not DB)
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: isProd ? '7d' : 0 }));

  console.log('Initializing database...');
  const dbInitialized = await initializeDatabase();

  if (dbInitialized) {
    console.log('Database initialized successfully');
    const migrationService = new MigrationService();
    await migrationService.runMigrations();

    if (process.env.NODE_ENV === 'development') {
      const dbInfo = await migrationService.getDatabaseInfo();
      if (dbInfo.stats.users === 0) {
        console.log('Seeding database with initial data...');
        await migrationService.seedDatabase();
      }
    }
  } else {
    console.error('Failed to initialize database');
    throw new Error('Failed to initialize database');
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/platform', platformRoutes);
  app.use('/api/equipment', equipmentRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/contracts', contractsRoutes);
  app.use('/api/insurance', insuranceRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/referral', referralRoutes);
  app.use('/api/discounts', discountRoutes);

  app.get('/api/health', async (_req, res) => {
    const migrationService = new MigrationService();
    const isHealthy = await migrationService.checkDatabaseHealth();
    res.json({
      status: isHealthy ? 'ok' : 'error',
      message: isHealthy ? 'Ijar API is running' : 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  });

  // Protected — admin only (was leaking schema/stats)
  app.get(
    '/api/database/info',
    authenticateToken,
    requireRole(['admin']),
    async (_req: AuthenticatedRequest, res) => {
      try {
        const migrationService = new MigrationService();
        const info = await migrationService.getDatabaseInfo();
        res.json(info);
      } catch {
        res.status(500).json({ error: 'Failed to get database info' });
      }
    }
  );

  if (!isProd) {
    app.post('/api/migrations/run', async (_req, res) => {
      try {
        const migrationService = new MigrationService();
        await migrationService.runMigrations();
        res.json({ message: 'Migrations completed successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Migration failed', details: errMsg(error) });
      }
    });

    app.post('/api/migrations/reset', async (_req, res) => {
      try {
        const migrationService = new MigrationService();
        await migrationService.resetDatabase();
        await migrationService.runMigrations();
        await migrationService.seedDatabase();
        res.json({ message: 'Database reset and seeded successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Database reset failed', details: errMsg(error) });
      }
    });

    app.get('/api/migrations/status', async (_req, res) => {
      try {
        const migrationService = new MigrationService();
        const status = await migrationService.getMigrationStatus();
        res.json(status);
      } catch {
        res.status(500).json({ error: 'Failed to get migration status' });
      }
    });
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wsService = new WebSocketService(server);
  await wsService.initialize();
  console.log('Database: PostgreSQL');
  console.log('Environment:', process.env.NODE_ENV || 'development');
}

startServer().catch(console.error);
