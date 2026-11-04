import { Router } from 'express';
import { login, getSuperAdminToken, getMe, updateProfile, forgotPassword, resetPassword } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.get('/superadmin-token', getSuperAdminToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);

export default router;
