import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticateToken } from './auth.middleware';
import { authSensitiveLimiter } from '../../middleware/rateLimit';

const router = Router();
const authController = new AuthController();

// Registration
router.post('/register', authSensitiveLimiter, authController.register);

// Login
router.post('/login', authSensitiveLimiter, authController.login);
router.post('/logout', authController.logout);

// Current User Profile
router.get('/me', authenticateToken, authController.me);
router.patch('/me', authenticateToken, authController.updateMe);

// Email Verification
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Password Reset
router.post('/forgot-password', authSensitiveLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/forgot-password-approval', authController.forgotPasswordApprovalRequest);
router.get('/forgot-password-status', authController.forgotPasswordStatus);
router.post('/reset-password-approved', authController.resetPasswordApproved);

export default router;
