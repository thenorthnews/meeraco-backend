import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  setProductStatus,
  deleteProduct,
  bulkImport
} from './product.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('catalogue', 'view'), getProducts);
router.post('/', checkPermission('catalogue', 'create'), createProduct);
router.post('/bulk', checkPermission('catalogue', 'create'), bulkImport);
router.get('/:id', checkPermission('catalogue', 'view'), getProductById);
router.put('/:id/status', checkPermission('catalogue', 'edit'), setProductStatus);
router.put('/:id', checkPermission('catalogue', 'edit'), updateProduct);
router.delete('/:id', checkPermission('catalogue', 'delete'), deleteProduct);

export default router;
