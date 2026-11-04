import { Router } from 'express';
import { getBranches, getBranchById, createBranch, updateBranch, setBranchStatus, deleteBranch } from './branch.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('branches', 'view'), getBranches);
router.post('/', checkPermission('branches', 'create'), createBranch);
router.get('/:id', checkPermission('branches', 'view'), getBranchById);
router.put('/:id/status', checkPermission('branches', 'edit'), setBranchStatus);
router.put('/:id', checkPermission('branches', 'edit'), updateBranch);
router.delete('/:id', checkPermission('branches', 'delete'), deleteBranch);

export default router;
