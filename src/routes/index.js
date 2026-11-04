import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import branchRoutes from '../modules/branch/branch.routes.js';
import leadRoutes from '../modules/lead/lead.routes.js';
import customerRoutes from '../modules/customer/customer.routes.js';
import quotationRoutes from '../modules/quotation/quotation.routes.js';
import productRoutes from '../modules/product/product.routes.js';
import roleRoutes from '../modules/role/role.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Meeraco CRM API',
    architecture: 'Modular Feature Architecture'
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/leads', leadRoutes);
router.use('/customers', customerRoutes);
router.use('/quotations', quotationRoutes);
router.use('/products', productRoutes);
router.use('/roles', roleRoutes);
router.use('/settings', settingsRoutes);

export default router;
