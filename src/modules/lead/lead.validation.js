import Joi from 'joi';

const optionalNumber = Joi.alternatives().try(
  Joi.number(),
  Joi.string().regex(/^[0-9.]*$/).allow('', null)
).allow(null);

export const createLeadSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Contact name is required',
    'any.required': 'Contact name is required'
  }),
  contactPerson: Joi.string().trim().allow('', null),
  company: Joi.string().trim().allow('', null),
  companyName: Joi.string().trim().allow('', null),
  title: Joi.string().trim().allow('', null),
  phone: Joi.string().pattern(/^[0-9+ -]{7,15}$/).required().messages({
    'string.pattern.base': 'Phone must be a valid phone number',
    'any.required': 'Phone number is required'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  city: Joi.string().trim().allow('', null),
  state: Joi.string().trim().allow('', null),
  district: Joi.string().trim().allow('', null),
  pincode: Joi.string().allow('', null),
  siteLocation: Joi.string().allow('', null),
  address: Joi.string().allow('', null),

  source: Joi.string().allow('', null).default('Website'),
  priority: Joi.string().valid('Hot', 'Warm', 'Cold').default('Warm'),
  stage: Joi.string().valid('New', 'Contacted', 'Qualified', 'Negotiation', 'Won', 'Lost', 'ProposalSent').default('New'),

  kva: optionalNumber,
  quantity: optionalNumber.default(1),
  estimatedValue: optionalNumber,
  value: optionalNumber,
  expectedClose: Joi.date().iso().allow('', null),

  branchId: Joi.string().allow('', null),
  assignedToId: Joi.string().allow('', null),
  assignedTo: Joi.string().allow('', null),
  assignedById: Joi.string().allow('', null),
  assignedBy: Joi.string().allow('', null),
  notes: Joi.any().allow('', null)
}).unknown(true);

export const updateLeadSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).allow('', null),
  contactPerson: Joi.string().trim().allow('', null),
  company: Joi.string().trim().allow('', null),
  companyName: Joi.string().trim().allow('', null),
  phone: Joi.string().pattern(/^[0-9+ -]{7,15}$/).allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  city: Joi.string().trim().allow('', null),
  state: Joi.string().trim().allow('', null),
  district: Joi.string().trim().allow('', null),
  pincode: Joi.string().allow('', null),
  siteLocation: Joi.string().allow('', null),

  source: Joi.string().allow('', null),
  priority: Joi.string().allow('', null),
  stage: Joi.string().allow('', null),
  active: Joi.boolean().allow(null),

  kva: optionalNumber,
  quantity: optionalNumber,
  estimatedValue: optionalNumber,
  value: optionalNumber,
  expectedClose: Joi.date().iso().allow('', null),

  branchId: Joi.string().allow('', null),
  assignedToId: Joi.string().allow('', null),
  assignedTo: Joi.string().allow('', null),
  assignedById: Joi.string().allow('', null),
  assignedBy: Joi.string().allow('', null),
  notes: Joi.any().allow('', null)
}).unknown(true);

export const updateLeadStageSchema = Joi.object({
  stage: Joi.string().trim().required().messages({
    'string.empty': 'Stage is required',
    'any.required': 'Stage is required'
  }),
  notes: Joi.any().allow('', null),
  lossReason: Joi.string().allow('', null),
  lostReason: Joi.string().allow('', null)
}).unknown(true);

export const reassignLeadSchema = Joi.object({
  assignedToId: Joi.string().allow('', null),
  assignedTo: Joi.string().allow('', null),
  reason: Joi.string().allow('', null)
});

