import Joi from 'joi';

export const createLeadSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    'string.empty': 'Lead title / subject is required',
    'any.required': 'Lead title is required'
  }),
  companyName: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Company name is required',
    'any.required': 'Company name is required'
  }),
  contactPerson: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Contact person name is required',
    'any.required': 'Contact person name is required'
  }),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Phone must be a valid 10-digit mobile number',
    'any.required': 'Phone number is required'
  }),
  city: Joi.string().trim().allow('', null),
  state: Joi.string().trim().allow('', null),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).allow('', null).messages({
    'string.pattern.base': 'Pincode must be 6 digits'
  }),
  address: Joi.string().allow('', null),
  source: Joi.string().default('Manual'),
  gensetRequirement: Joi.string().allow('', null),
  estimatedKva: Joi.number().positive().allow(null),
  estimatedValue: Joi.number().min(0).allow(null),
  notes: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null),
  assignedToId: Joi.string().allow('', null)
});

export const updateLeadStageSchema = Joi.object({
  stage: Joi.string().valid('New', 'Contacted', 'Qualified', 'ProposalSent', 'Negotiation', 'Won', 'Lost').required().messages({
    'any.only': 'Stage must be one of New, Contacted, Qualified, ProposalSent, Negotiation, Won, Lost',
    'any.required': 'Stage is required'
  }),
  notes: Joi.string().allow('', null),
  lostReason: Joi.string().when('stage', {
    is: 'Lost',
    then: Joi.required().messages({ 'any.required': 'Lost reason is mandatory when marking lead as Lost' }),
    otherwise: Joi.optional().allow('', null)
  })
});

export const reassignLeadSchema = Joi.object({
  assignedToId: Joi.string().required().messages({
    'any.required': 'New assigned user ID is required'
  }),
  reason: Joi.string().allow('', null)
});

