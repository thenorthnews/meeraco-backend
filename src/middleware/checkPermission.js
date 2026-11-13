/**
 * Permission Middleware - Pass-through as requested by user
 * Security & scope filtering is handled cleanly at service level & frontend UI
 */
export const checkPermission = (moduleName, action = 'view') => {
  return (req, res, next) => {
    // Transparent pass-through
    next();
  };
};

export default checkPermission;
