import Joi from 'joi';

export const createBranchSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(2).max(10).required().messages({
    'string.empty': 'Branch code is required (e.g., DEL, MUM)',
    'any.required': 'Branch code is required'
  }),
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Branch name is required',
    'any.required': 'Branch name is required'
  }),
  state: Joi.string().trim().required().messages({
    'any.required': 'State is required'
  }),
  city: Joi.string().trim().required().messages({
    'any.required': 'City is required'
  }),
  address: Joi.string().allow('', null).optional(),
  gstin: Joi.string().allow('', null).optional(),
  phone: Joi.string().allow('', null).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null).optional(),
  managerId: Joi.string().allow('', null).optional(),
  territories: Joi.array().items(
    Joi.object({
      state: Joi.string().required(),
      districts: Joi.array().items(Joi.string()).optional(),
      city: Joi.string().allow('', null),
      pincode: Joi.string().allow('', null)
    })
  ).allow(null).optional(),
  active: Joi.boolean().optional()
});
