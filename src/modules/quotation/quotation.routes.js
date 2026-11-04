import { Router } from 'express';
import { getQuotations, createQuotation, updateQuotationStatus } from './quotation.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('quotations', 'view'), getQuotations);
router.post('/', checkPermission('quotations', 'create'), createQuotation);
router.patch('/:id/status', checkPermission('quotations', 'edit'), updateQuotationStatus);

export default router;
