import { Router } from 'express';
import { getLeads, getLeadById, createLead, updateLeadStage, reassignLead } from './lead.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('leads', 'view'), getLeads);
router.get('/:id', checkPermission('leads', 'view'), getLeadById);
router.post('/', checkPermission('leads', 'create'), createLead);
router.patch('/:id/stage', checkPermission('leads', 'edit'), updateLeadStage);
router.patch('/:id/reassign', checkPermission('reassign', 'edit'), reassignLead);

export default router;
