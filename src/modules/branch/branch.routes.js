import { Router } from 'express';
import { getBranches, getBranchById, createBranch, updateBranch, setBranchStatus, deleteBranch } from './branch.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', getBranches);
router.post('/', createBranch);
router.get('/:id', getBranchById);
router.put('/:id/status', setBranchStatus);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

export default router;
