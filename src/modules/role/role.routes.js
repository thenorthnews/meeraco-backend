import { Router } from 'express';
import * as roleController from './role.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('roles', 'view'), roleController.getRoles);
router.get('/:id', checkPermission('roles', 'view'), roleController.getRoleById);
router.post('/', checkPermission('roles', 'create'), roleController.createRole);
router.put('/:id/permissions', checkPermission('roles', 'edit'), roleController.setRolePermission);
router.put('/:id', checkPermission('roles', 'edit'), roleController.updateRole);
router.delete('/:id', checkPermission('roles', 'delete'), roleController.deleteRole);

export default router;
