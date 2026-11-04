import { Router } from 'express';
import { getUsers, createUser, updateUser, setUserActiveStatus, deleteUser } from './user.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('users', 'view'), getUsers);
router.post('/', checkPermission('users', 'create'), createUser);
router.put('/:id', checkPermission('users', 'edit'), updateUser);
router.patch('/:id/status', checkPermission('users', 'edit'), setUserActiveStatus);
router.delete('/:id', checkPermission('users', 'delete'), deleteUser);

export default router;
