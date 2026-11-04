import { Router } from 'express';
import { getProducts, createProduct } from './product.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('catalogue', 'view'), getProducts);
router.post('/', checkPermission('catalogue', 'edit'), createProduct);

export default router;
