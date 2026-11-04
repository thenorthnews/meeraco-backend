import Joi from 'joi';

export const createProductSchema = Joi.object({
  code: Joi.string().trim().uppercase().required().messages({
    'string.empty': 'Product code is required',
    'any.required': 'Product code is required'
  }),
  kind: Joi.string().valid('Genset', 'Accessory', 'Service', 'SparePart').default('Genset'),
  name: Joi.string().trim().required().messages({
    'string.empty': 'Product name is required',
    'any.required': 'Product name is required'
  }),
  kva: Joi.number().positive().allow(null),
  engineMake: Joi.string().allow('', null),
  alternatorMake: Joi.string().allow('', null),
  fuel: Joi.string().allow('', null),
  phase: Joi.string().allow('', null),
  specs: Joi.string().allow('', null),
  basePrice: Joi.number().min(0).required().messages({
    'any.required': 'Base price is required'
  }),
  gstPct: Joi.number().min(0).max(28).default(18)
});

