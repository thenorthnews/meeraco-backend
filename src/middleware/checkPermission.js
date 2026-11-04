import { unauthorized, forbidden } from '../helpers/response.helper.js';

export const checkPermission = (moduleName, action = 'view') => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return unauthorized(res, 'Authentication required');
    }

    // Super Admin has unrestricted access
    if (
      user.role === 'super_admin' ||
      user.role === 'Super Admin' ||
      user.roleId === 'super_admin' ||
      user.roleId?.name === 'Super Admin'
    ) {
      return next();
    }

    const permissions = user.permissions;
    const hasAccess = permissions?.[moduleName]?.[action];

    if (!hasAccess) {
      return forbidden(res, `Forbidden: You do not have '${action}' permission for '${moduleName}'`);
    }

    next();
  };
};
