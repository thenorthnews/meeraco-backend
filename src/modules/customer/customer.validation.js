import Joi from 'joi';

export const createCustomerSchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Company name is required',
    'any.required': 'Company name is required'
  }),
  customerType: Joi.string().valid('Individual', 'Corporate', 'Government', 'Dealer').default('Corporate'),
  industry: Joi.string().allow('', null),
  gstin: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).allow('', null).messages({
    'string.pattern.base': 'Please provide a valid 15-character Indian GSTIN'
  }),
  pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).allow('', null).messages({
    'string.pattern.base': 'Please provide a valid 10-character PAN'
  }),
  billingAddress: Joi.string().allow('', null),
  billingCity: Joi.string().allow('', null),
  billingState: Joi.string().allow('', null),
  billingPincode: Joi.string().pattern(/^[0-9]{6}$/).allow('', null),
  shippingAddress: Joi.string().allow('', null),
  shippingCity: Joi.string().allow('', null),
  shippingState: Joi.string().allow('', null),
  shippingPincode: Joi.string().pattern(/^[0-9]{6}$/).allow('', null),
  primaryContactName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Primary contact name is required'
  }),
  primaryContactPhone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Contact phone must be a 10-digit number',
    'any.required': 'Primary contact phone is required'
  }),
  primaryContactEmail: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  designation: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null)
});

export const addContactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Contact name is required'
  }),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Phone must be 10 digits',
    'any.required': 'Phone number is required'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  designation: Joi.string().allow('', null),
  department: Joi.string().allow('', null),
  isPrimary: Joi.boolean().default(false)
});

