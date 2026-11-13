import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerContact
} from './customer.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('customers', 'view'), getCustomers);
router.get('/:id', checkPermission('customers', 'view'), getCustomerById);
router.post('/', checkPermission('customers', 'create'), createCustomer);
router.put('/:id', checkPermission('customers', 'edit'), updateCustomer);
router.delete('/:id', checkPermission('customers', 'delete'), deleteCustomer);
router.post('/:id/contacts', checkPermission('customers', 'edit'), addCustomerContact);

export default router;
