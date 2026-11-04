import { Router } from 'express';
import * as roleController from './role.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', roleController.getRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.put('/:id/permissions', roleController.setRolePermission);
router.delete('/:id', roleController.deleteRole);

export default router;
