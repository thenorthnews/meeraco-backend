import jwt from 'jsonwebtoken';
import { User, SuperAdmin } from '../models/index.js';
import { unauthorized, forbidden } from '../helpers/response.helper.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const secret = process.env.JWT_SECRET || 'meeraco-crm-super-secret-key-2026';

    // 1. If Bearer token is provided, verify it
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, secret);
        const userId = decoded.userId || decoded.id;

        // Check in User model
        let user = await User.findById(userId).populate('roleId').populate('branchId').lean();

        // If not found in User, check in SuperAdmin model
        if (!user) {
          const superAdmin = await SuperAdmin.findById(userId).lean();
          if (superAdmin) {
            user = {
              ...superAdmin,
              id: superAdmin._id.toString(),
              role: 'Admin' || 'admin',
              roleId: { name: 'Admin' || 'admin', scope: 'all' }
            };
          }
        }

        if (user) {
          if (!user.active && user.role !== 'admin' && user.role !== 'Admin') {
            return forbidden(res, 'User account has been deactivated. Please contact administrator.');
          }

          req.user = user;
          req.user.id = user._id ? user._id.toString() : user.id;
          req.user.role = user.roleId?.name || user.role || 'User';
          req.user.roleName = user.roleId?.name || user.role || 'User';
          req.user.branchId = user.branchId?._id || user.branchId || null;
          return next();
        }
      } catch (tokenErr) {
        // Token was invalid or expired - proceed to Super Admin fallback below
      }
    }

    // 2. Admin / Super Admin fallback:
    // Admin ko mandatory token validation ki need nahi hai
    // Development me ya x-user-role Admin hone par auto-authorize
    const userRoleHeader = req.headers['x-user-role'];
    const isSuperAdminRequested =
      !userRoleHeader ||
      userRoleHeader === 'admin' ||
      userRoleHeader === 'Admin' ||
      process.env.NODE_ENV !== 'production';

    if (isSuperAdminRequested) {
      const superAdmin = await SuperAdmin.findOne().lean();
      if (superAdmin) {
        req.user = {
          ...superAdmin,
          id: superAdmin._id.toString(),
          role: 'Admin',
          roleId: { name: 'Admin', scope: 'all' }
        };
        req.user.id = superAdmin._id.toString();
        return next();
      }
    }

    return unauthorized(res, 'Authorization token missing or malformed');
  } catch (error) {
    return unauthorized(res, `Authentication failed: ${error.message}`);
  }
};
