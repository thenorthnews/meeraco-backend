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

// Lead Masters (Stages, Sources, Priorities, Loss Reasons)
router.get('/lead-masters', checkPermission('lead_setup', 'view'), settingsController.getLeadMasters);
router.post('/lead-masters', checkPermission('lead_setup', 'create'), settingsController.createLeadMaster);
router.put('/lead-masters/reorder', checkPermission('lead_setup', 'edit'), settingsController.reorderLeadMasters);
router.put('/lead-masters/:id', checkPermission('lead_setup', 'edit'), settingsController.updateLeadMaster);
router.delete('/lead-masters/:id', checkPermission('lead_setup', 'delete'), settingsController.deleteLeadMaster);

// Assignment Rules
router.get('/assignment-rules', checkPermission('assignment', 'view'), settingsController.getAssignmentRules);
router.post('/assignment-rules', checkPermission('assignment', 'create'), settingsController.createAssignmentRule);
router.put('/assignment-rules/reorder', checkPermission('assignment', 'edit'), settingsController.reorderAssignmentRules);
router.put('/assignment-rules/:id/status', checkPermission('assignment', 'edit'), settingsController.setAssignmentRuleStatus);
router.put('/assignment-rules/:id', checkPermission('assignment', 'edit'), settingsController.updateAssignmentRule);
router.delete('/assignment-rules/:id', checkPermission('assignment', 'delete'), settingsController.deleteAssignmentRule);
router.get('/audit-logs', checkPermission('audit', 'view'), settingsController.getAuditLogs);

export default router;
