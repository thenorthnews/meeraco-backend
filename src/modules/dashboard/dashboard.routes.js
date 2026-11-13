import { Router } from 'express';
import { getDashboardMetrics } from './dashboard.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('dashboard', 'view'), getDashboardMetrics);

export default router;

