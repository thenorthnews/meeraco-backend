import Joi from 'joi';

export const createProductSchema = Joi.object({
  code: Joi.string().trim().uppercase().allow('', null).optional(),
  kind: Joi.string().valid('Genset', 'Accessory', 'Service charge', 'Service', 'SparePart').default('Genset'),
  name: Joi.string().trim().required().messages({
    'string.empty': 'Product name is required',
    'any.required': 'Product name is required'
  }),
  kva: Joi.number().positive().allow(null, 0, ''),
  engineMake: Joi.string().allow('', null).default('Cummins'),
  alternatorMake: Joi.string().allow('', null).default('Stamford'),
  fuel: Joi.string().allow('', null).default('Diesel'),
  phase: Joi.string().allow('', null).default('Three'),
  specs: Joi.string().allow('', null).default(''),
  price: Joi.number().min(0).allow(null, '').default(0),
  basePrice: Joi.number().min(0).allow(null, '').default(0),
  gstPct: Joi.number().min(0).max(28).default(18),
  active: Joi.boolean().default(true)
});

export const updateProductSchema = Joi.object({
  code: Joi.string().trim().uppercase().allow('', null).optional(),
  kind: Joi.string().valid('Genset', 'Accessory', 'Service charge', 'Service', 'SparePart').optional(),
  name: Joi.string().trim().optional(),
  kva: Joi.number().positive().allow(null, 0, '').optional(),
  engineMake: Joi.string().allow('', null).optional(),
  alternatorMake: Joi.string().allow('', null).optional(),
  fuel: Joi.string().allow('', null).optional(),
  phase: Joi.string().allow('', null).optional(),
  specs: Joi.string().allow('', null).optional(),
  price: Joi.number().min(0).allow(null, '').optional(),
  basePrice: Joi.number().min(0).allow(null, '').optional(),
  gstPct: Joi.number().min(0).max(28).optional(),
  active: Joi.boolean().optional()
});

