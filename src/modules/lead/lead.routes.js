import { Router } from 'express';
import {
  getLeads,
  getLeadById,
  getLeadActivities,
  createLead,
  updateLead,
  updateLeadStage,
  reassignLead,
  deleteLead
} from './lead.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', getLeads);
router.get('/:id',getLeadById);
router.get('/:id/activities', getLeadActivities);
router.post('/', createLead);
router.put('/:id',  updateLead);
router.patch('/:id/stage', updateLeadStage);
router.patch('/:id/reassign', reassignLead);
router.delete('/:id', deleteLead);

export default router;
