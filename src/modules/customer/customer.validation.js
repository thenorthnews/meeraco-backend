import Joi from 'joi';

const contactItemSchema = Joi.object({
  id: Joi.string().allow('', null),
  _id: Joi.string().allow('', null),
  name: Joi.string().allow('', null),
  designation: Joi.string().allow('', null),
  mobile: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  email: Joi.string().allow('', null),
  primary: Joi.boolean().default(false)
});

export const createCustomerSchema = Joi.object({
  name: Joi.string().trim().allow('', null),
  companyName: Joi.string().trim().allow('', null),
  type: Joi.string().allow('', null).default('Business'),
  customerType: Joi.string().allow('', null),
  industry: Joi.string().allow('', null),
  segment: Joi.string().allow('', null),
  gstin: Joi.string().trim().allow('', null),
  pan: Joi.string().trim().allow('', null),
  billingAddress: Joi.string().allow('', null),
  siteAddresses: Joi.array().items(Joi.string().allow('', null)).allow(null),
  siteText: Joi.string().allow('', null),
  city: Joi.string().allow('', null),
  district: Joi.string().allow('', null),
  state: Joi.string().allow('', null),
  pincode: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null),
  ownerId: Joi.string().allow('', null),
  active: Joi.boolean().default(true),
  contacts: Joi.array().items(contactItemSchema).allow(null),
  primaryContactName: Joi.string().allow('', null),
  primaryContactPhone: Joi.string().allow('', null),
  primaryContactEmail: Joi.string().allow('', null)
}).custom((value, helpers) => {
  if (!value.companyName && !value.name) {
    return helpers.message('Customer or Company name is required');
  }
  return value;
});

export const updateCustomerSchema = Joi.object({
  name: Joi.string().trim().allow('', null),
  companyName: Joi.string().trim().allow('', null),
  type: Joi.string().allow('', null),
  customerType: Joi.string().allow('', null),
  industry: Joi.string().allow('', null),
  segment: Joi.string().allow('', null),
  gstin: Joi.string().trim().allow('', null),
  pan: Joi.string().trim().allow('', null),
  billingAddress: Joi.string().allow('', null),
  siteAddresses: Joi.array().items(Joi.string().allow('', null)).allow(null),
  siteText: Joi.string().allow('', null),
  city: Joi.string().allow('', null),
  district: Joi.string().allow('', null),
  state: Joi.string().allow('', null),
  pincode: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null),
  ownerId: Joi.string().allow('', null),
  active: Joi.boolean(),
  contacts: Joi.array().items(contactItemSchema).allow(null),
  primaryContactName: Joi.string().allow('', null),
  primaryContactPhone: Joi.string().allow('', null),
  primaryContactEmail: Joi.string().allow('', null)
});

export const addContactSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'any.required': 'Contact name is required'
  }),
  phone: Joi.string().allow('', null),
  mobile: Joi.string().allow('', null),
  email: Joi.string().allow('', null),
  designation: Joi.string().allow('', null),
  department: Joi.string().allow('', null),
  primary: Joi.boolean().default(false),
  isPrimary: Joi.boolean().default(false)
});
