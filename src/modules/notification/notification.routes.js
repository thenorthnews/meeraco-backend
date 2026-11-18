import { Router } from 'express';
import { getNotifications, registerDeviceToken, markNotificationRead, markAllNotificationsRead } from './notification.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.post('/device-token', registerDeviceToken);
router.patch('/:id/read', markNotificationRead);
router.post('/:id/read', markNotificationRead);
router.post('/read-all', markAllNotificationsRead);

export default router;

