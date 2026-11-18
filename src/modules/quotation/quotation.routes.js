import { Router } from 'express';
import { getQuotations, getQuotationById, createQuotation, updateQuotation, updateQuotationStatus, deleteQuotation } from './quotation.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { checkPermission } from '../../middleware/checkPermission.js';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('quotations', 'view'), getQuotations);
router.get('/:id', checkPermission('quotations', 'view'), getQuotationById);
router.post('/', checkPermission('quotations', 'create'), createQuotation);
router.put('/:id', checkPermission('quotations', 'edit'), updateQuotation);
router.patch('/:id/status', checkPermission('quotations', 'edit'), updateQuotationStatus);
router.delete('/:id', checkPermission('quotations', 'delete'), deleteQuotation);

export default router;
