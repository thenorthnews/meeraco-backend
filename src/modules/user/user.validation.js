import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'User name is required',
    'any.required': 'User name is required'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Valid email is required',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).max(100).default('meeraco@123'),
  mobile: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  roleId: Joi.string().required().messages({
    'any.required': 'Role is required'
  }),
  roleName: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null),
  managerId: Joi.string().allow('', null),
  districts: Joi.array().items(Joi.string()).allow(null),
  active: Joi.boolean().default(true),
  mobileAccess: Joi.boolean().default(true)
});

export const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().email({ tlds: { allow: false } }),
  mobile: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  roleId: Joi.string(),
  roleName: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null),
  managerId: Joi.string().allow('', null),
  districts: Joi.array().items(Joi.string()).allow(null),
  active: Joi.boolean(),
  mobileAccess: Joi.boolean(),
  password: Joi.string().min(6).allow('', null)
}).min(1);

export const setUserStatusSchema = Joi.object({
  active: Joi.boolean().required().messages({
    'any.required': 'Active status boolean is required'
  })
});
