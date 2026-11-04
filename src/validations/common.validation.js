import Joi from 'joi';

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().allow('', null).optional(),
  sortBy: Joi.string().allow('', null).optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
}).unknown(true); // Allow additional filter params like stage, branchId, etc.

export const idParamSchema = Joi.object({
  id: Joi.string().required().messages({
    'any.required': 'Resource ID parameter is required'
  })
});

