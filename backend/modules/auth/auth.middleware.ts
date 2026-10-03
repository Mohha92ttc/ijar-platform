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

function getJwtSecret(): string {
  return process.env.JWT_SECRET || '';
}

function readTokens(req: Request): string[] {
  // Prefer httpOnly cookie first — localStorage Bearer often goes stale after JWT_SECRET / redeploy
  const tokens: string[] = [];
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.split(' ')[1];
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.ijar_token;
  if (cookieToken) tokens.push(cookieToken);
  if (bearer && bearer !== cookieToken) tokens.push(bearer);
  return tokens;
}

async function loadUser(userId: string): Promise<AuthenticatedRequest['user'] | null> {
  const dbRes = await query(
    `SELECT id, email, role, is_approved, is_email_verified, subscription_status
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  if (dbRes.rows.length === 0) return null;
  const dbUser = dbRes.rows[0] as {
    id: string;
    email: string;
    role: string;
    is_approved: boolean;
    is_email_verified: boolean;
    subscription_status: string | null;
  };
  return {
    userId: dbUser.id,
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    isApproved: dbUser.is_approved,
    isEmailVerified: dbUser.is_email_verified,
    subscriptionStatus: dbUser.subscription_status,
  };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const JWT_SECRET = getJwtSecret();
    if (!JWT_SECRET || JWT_SECRET.length < 16) {
      return res.status(500).json({ error: 'JWT secret is not configured securely' });
    }

    const tokens = readTokens(req);
    if (tokens.length === 0) {
      return res.status(401).json({ error: 'Access token required' });
    }

    for (const token of tokens) {
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

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedRequest['user'];
        const userId = decoded?.userId ?? decoded?.id;
        if (!userId) continue;

        const user = await loadUser(userId);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }
        if (user.subscriptionStatus === 'banned') {
          return res.status(403).json({ error: 'Account is banned' });
        }
        if (user.isApproved === false) {
          return res.status(403).json({ error: 'Account is pending approval' });
        }
        if (user.role === 'customer' && !user.isEmailVerified) {
          return res.status(403).json({ error: 'Email verification required' });
        }

        req.user = user;
        return next();
      } catch {
        // try next token (e.g. stale Bearer, valid cookie)
      }
    }

    return res.status(401).json({ error: 'Invalid token' });
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
