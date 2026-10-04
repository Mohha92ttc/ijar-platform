import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.middleware';
import { publicError } from '../../utils/publicError';

const COOKIE_NAME = 'ijar_token';
const isProd = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response) => {
    try {
      const { name, email, phone, password, role, auto_approve } = req.body;
      const result = await this.authService.register({ name, email, phone, password, role, auto_approve });
      // Don't overwrite an existing admin/session cookie when admin creates a user
      const hasExistingSession =
        Boolean(req.headers.authorization) ||
        Boolean((req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME]);
      if (result.token && !hasExistingSession) {
        setAuthCookie(res, result.token);
        res.status(201).json(result);
        return;
      }
      // Strip token so admin UI never adopts the new user's session
      const { token: _omit, ...safe } = result as unknown as { token?: string } & Record<string, unknown>;
      res.status(201).json(safe);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل التسجيل') });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      if (result.token) setAuthCookie(res, result.token);
      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(401).json({ error: publicError(error, 'فشل تسجيل الدخول') });
    }
  };

  logout = async (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.status(200).json({ message: 'Logged out' });
  };

  me = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await this.authService.getMe(req.user.userId);
      res.status(200).json(user);
    } catch (error: unknown) {
      res.status(404).json({ error: publicError(error, 'المستخدم غير موجود') });
    }
  };

  updateMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { name, email, phone, currentPassword, newPassword } = req.body;
      await this.authService.updateMe(req.user.userId, { name, email, phone, currentPassword, newPassword });
      res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل التحديث') });
    }
  };

  verifyEmail = async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      await this.authService.verifyEmail(token);
      res.status(200).json({ message: 'Email verified successfully' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل التحقق') });
    }
  };

  forgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      await this.authService.requestPasswordReset(email);
      res.status(200).json({ message: 'Password reset link sent to email' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل الطلب') });
    }
  };

  forgotPasswordApprovalRequest = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      await this.authService.requestPasswordResetWithAdminApproval(email);
      res.status(200).json({ message: 'Password reset approval requested' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل الطلب') });
    }
  };

  forgotPasswordStatus = async (req: Request, res: Response) => {
    try {
      const email = String(req.query.email || '');
      const status = await this.authService.getPasswordResetStatusByEmail(email);
      res.status(200).json(status);
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل الاستعلام') });
    }
  };

  resetPasswordApproved = async (req: Request, res: Response) => {
    try {
      const { email, newPassword, completionToken } = req.body;
      await this.authService.completeApprovedPasswordResetByEmail(email, newPassword, completionToken);
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل تحديث كلمة المرور') });
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      await this.authService.resetPassword(token, newPassword);
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error: unknown) {
      res.status(400).json({ error: publicError(error, 'فشل إعادة التعيين') });
    }
  };
}
