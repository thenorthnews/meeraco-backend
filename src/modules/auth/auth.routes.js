import { Router } from 'express';
import {
  sendOtp,
  resendOtp,
  verifyOtp,
  getSuperAdminToken,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword
} from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// 📲 Phone Number + OTP Authentication Routes
router.post('/send-otp', sendOtp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);

// Helper / Profile Routes
router.get('/superadmin-token', getSuperAdminToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

export default router;
