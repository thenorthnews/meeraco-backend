/**
 * Standardized API Response Helper Functions
 * Consistent JSON format across the entire application:
 * {
 *   success: true | false,
 *   statusCode: number,
 *   message: string,
 *   data?: any,
 *   errors?: string[] | any,
 *   pagination?: object
 * }
 */

// 200 OK
export const ok = (res, message = 'Success', data = null) => {
  return res.status(200).json({
    success: true,
    statusCode: 200,
    message,
    data
  });
};

// 201 Created
export const created = (res, message = 'Resource created successfully', data = null) => {
  return res.status(201).json({
    success: true,
    statusCode: 201,
    message,
    data
  });
};

// 400 Bad Request / Validation Failure
export const badRequest = (res, message = 'Bad request', errors = null) => {
  return res.status(400).json({
    success: false,
    statusCode: 400,
    message,
    errors: errors ? (Array.isArray(errors) ? errors : [errors]) : undefined
  });
};

// 401 Unauthorized
export const unauthorized = (res, message = 'Unauthorized access') => {
  return res.status(401).json({
    success: false,
    statusCode: 401,
    message
  });
};

// 403 Forbidden
export const forbidden = (res, message = 'Forbidden: Access denied') => {
  return res.status(403).json({
    success: false,
    statusCode: 403,
    message
  });
};

// 404 Not Found
export const notFound = (res, message = 'Resource not found') => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    message
  });
};

// 500 Internal Server Error
export const serverError = (res, message = 'Internal server error occurred', error = null) => {
  return res.status(500).json({
    success: false,
    statusCode: 500,
    message,
    error: process.env.NODE_ENV === 'development' ? (error?.message || error) : undefined
  });
};

// Structured Pagination
export const paginated = (res, {
  items = [],
  total = 0,
  page = 1,
  limit = 20,
  message = 'Data retrieved successfully'
}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.max(1, Number(limit) || 20);
  const totalPages = Math.ceil(total / currentLimit) || 1;

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message,
    data: items,
    pagination: {
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }
  });
};

// Aliases for compatibility
export const sendSuccess = ok;
export const sendError = (res, msg, status = 500, err = null) => {
  if (status === 400) return badRequest(res, msg, err);
  if (status === 401) return unauthorized(res, msg);
  if (status === 403) return forbidden(res, msg);
  if (status === 404) return notFound(res, msg);
  return serverError(res, msg, err);
};
export const sendPaginated = (res, items, total, page, limit, message) =>
  paginated(res, { items, total, page, limit, message });
