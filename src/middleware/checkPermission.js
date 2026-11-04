import { unauthorized, forbidden } from '../helpers/response.helper.js';
import { RolePermission, Role } from '../models/index.js';

/**
 * Dynamic Role-Based Permission Validation Middleware
 * Checks user permissions directly from MongoDB database in real-time.
 * Default deny if permission is missing or false.
 * Super Admin always has unrestricted access.
 */
export const checkPermission = (moduleName, action = 'view') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return unauthorized(res, 'Authentication required');
      }

      // 1. Super Admin has unrestricted access to all modules and actions
      if (
        user.role === 'super_admin' ||
        user.role === 'Super Admin' ||
        user.roleId === 'super_admin' ||
        user.roleId?.name === 'Super Admin' ||
        user.isSystem
      ) {
        return next();
      }

      // 2. Resolve Role ObjectId
      let roleId = user.roleId?._id || user.roleId;

      if (!roleId || (typeof roleId === 'string' && !roleId.match(/^[0-9a-fA-F]{24}$/))) {
        const foundRole = await Role.findOne({
          $or: [
            { name: user.role },
            { name: user.roleName },
            ...(roleId ? [{ _id: roleId }] : [])
          ]
        }).lean();

        if (foundRole) {
          if (foundRole.isSystem) return next();
          roleId = foundRole._id;
        }
      }

      if (!roleId) {
        return forbidden(res, `Forbidden: No valid role assigned to user for '${moduleName}'`);
      }

      // 3. Query dynamic permission in real-time from database
      const permRecord = await RolePermission.findOne({ roleId, module: moduleName }).lean();

      if (!permRecord) {
        return forbidden(res, `Forbidden: You do not have '${action}' permission for '${moduleName}'`);
      }

      // 4. Map action to schema field: view -> canView, create -> canCreate, edit -> canEdit, delete -> canDelete, export -> canExport
      const actionMap = {
        view: 'canView',
        create: 'canCreate',
        edit: 'canEdit',
        delete: 'canDelete',
        export: 'canExport'
      };

      const field = actionMap[action] || `can${action.charAt(0).toUpperCase() + action.slice(1)}`;
      const hasPermission = Boolean(permRecord[field]);

      if (!hasPermission) {
        return forbidden(res, `Forbidden: You do not have '${action}' permission for '${moduleName}'`);
      }

      return next();
    } catch (err) {
      return forbidden(res, `Authorization error: ${err.message}`);
    }
  };
};
