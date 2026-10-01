import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../../database/connection';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    id?: string;
    email?: string;
    role: string;
    isApproved?: boolean;
    isEmailVerified?: boolean;
    subscriptionStatus?: string | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || '';

function readToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.split(' ')[1];
  if (bearer) return bearer;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.ijar_token;
  return cookieToken || null;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!JWT_SECRET || JWT_SECRET.length < 16) {
      return res.status(500).json({ error: 'JWT secret is not configured securely' });
    }
    const token = readToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Explicit opt-in only — NEVER active in production
    if (
      token === 'mock-token' &&
      process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_MOCK_AUTH === 'true'
    ) {
      req.user = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'admin',
        isApproved: true,
        isEmailVerified: true,
        subscriptionStatus: 'active',
      };
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedRequest['user'];
    const userId = decoded?.userId ?? decoded?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const dbRes = await query(
      `SELECT id, email, role, is_approved, is_email_verified, subscription_status
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (dbRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const dbUser = dbRes.rows[0] as {
      id: string;
      email: string;
      role: string;
      is_approved: boolean;
      is_email_verified: boolean;
      subscription_status: string | null;
    };

    if (dbUser.subscription_status === 'banned') {
      return res.status(403).json({ error: 'Account is banned' });
    }

    if (!dbUser.is_approved) {
      return res.status(403).json({ error: 'Account is pending approval' });
    }

    if (dbUser.role === 'customer' && !dbUser.is_email_verified) {
      return res.status(403).json({ error: 'Email verification required' });
    }

    req.user = {
      userId: dbUser.id,
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      isApproved: dbUser.is_approved,
      isEmailVerified: dbUser.is_email_verified,
      subscriptionStatus: dbUser.subscription_status,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (req.user.isApproved === false) {
      return res.status(403).json({ error: 'Account is pending approval' });
    }

    next();
  };
};
