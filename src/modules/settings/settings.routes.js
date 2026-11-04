import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/upload-logo', settingsController.uploadLogo);

router.get('/company', settingsController.getCompanyProfile);
router.put('/company', settingsController.updateCompanyProfile);

router.get('/general', settingsController.getGeneralSettings);
router.put('/general', settingsController.updateGeneralSettings);

router.get('/lead-masters', settingsController.getLeadMasters);
router.get('/assignment-rules', settingsController.getAssignmentRules);
router.get('/audit-logs', settingsController.getAuditLogs);

export default router;
