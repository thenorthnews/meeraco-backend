import Joi from 'joi';

export const updateGeneralSettingsSchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(150).allow('', null),
  organizationName: Joi.string().trim().allow('', null),
  registeredAddress: Joi.string().allow('', null),
  headOfficeAddress: Joi.string().allow('', null),
  gstin: Joi.string().allow('', null),
  pan: Joi.string().allow('', null),
  cin: Joi.string().allow('', null),
  logoUrl: Joi.string().allow('', null),
  financialYearStart: Joi.string().allow('', null),
  fiscalYearStart: Joi.string().allow('', null),
  dateFormat: Joi.string().allow('', null),
  currency: Joi.string().allow('', null),
  smtpHost: Joi.string().allow('', null),
  smtpPort: Joi.alternatives().try(Joi.number(), Joi.string()).allow('', null),
  smtpUser: Joi.string().allow('', null),
  smtpFrom: Joi.string().allow('', null),
  smtpPass: Joi.string().allow('', null),
  supportEmail: Joi.string().email({ tlds: { allow: false } }).allow('', null),
  supportPhone: Joi.string().allow('', null),
  brandTagline: Joi.string().allow('', null),
  website: Joi.string().allow('', null)
}).min(1);

