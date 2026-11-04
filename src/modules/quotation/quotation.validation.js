import Joi from 'joi';

const quotationItemSchema = Joi.object({
  productId: Joi.string().allow('', null),
  itemType: Joi.string().valid('Genset', 'Accessory', 'Service', 'AMC').default('Genset'),
  description: Joi.string().trim().required().messages({
    'any.required': 'Item description is required'
  }),
  kva: Joi.number().positive().allow(null),
  quantity: Joi.number().integer().positive().default(1),
  unitPrice: Joi.number().min(0).required().messages({
    'any.required': 'Unit price is required'
  }),
  discountPct: Joi.number().min(0).max(100).default(0),
  gstPct: Joi.number().min(0).max(28).default(18)
});

export const createQuotationSchema = Joi.object({
  leadId: Joi.string().allow('', null),
  customerId: Joi.string().allow('', null),
  branchId: Joi.string().allow('', null),
  clientState: Joi.string().allow('', null),
  deliveryTerms: Joi.string().allow('', null),
  paymentTerms: Joi.string().allow('', null),
  warrantyMonths: Joi.number().integer().min(0).default(24),
  freightAmount: Joi.number().min(0).default(0),
  validUntil: Joi.date().iso().allow(null),
  notes: Joi.string().allow('', null),
  items: Joi.array().items(quotationItemSchema).min(1).required().messages({
    'array.min': 'At least one line item is required in the quotation',
    'any.required': 'Quotation items are required'
  })
});

export const updateQuotationStatusSchema = Joi.object({
  status: Joi.string().valid('Draft', 'Sent', 'Approved', 'Rejected', 'Expired').required().messages({
    'any.only': 'Status must be one of Draft, Sent, Approved, Rejected, Expired',
    'any.required': 'Status is required'
  }),
  notes: Joi.string().allow('', null)
});

