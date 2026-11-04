import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.post('/upload-logo', checkPermission('general_settings', 'edit'), settingsController.uploadLogo);

router.get('/company', checkPermission('general_settings', 'view'), settingsController.getCompanyProfile);
router.put('/company', checkPermission('general_settings', 'edit'), settingsController.updateCompanyProfile);

router.get('/general', checkPermission('general_settings', 'view'), settingsController.getGeneralSettings);
router.put('/general', checkPermission('general_settings', 'edit'), settingsController.updateGeneralSettings);

router.get('/lead-masters', checkPermission('lead_setup', 'view'), settingsController.getLeadMasters);
router.get('/assignment-rules', checkPermission('assignment', 'view'), settingsController.getAssignmentRules);
router.get('/audit-logs', checkPermission('audit', 'view'), settingsController.getAuditLogs);

export default router;
