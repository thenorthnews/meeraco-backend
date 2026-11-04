import Joi from 'joi';

export const createRoleSchema = Joi.object({
  id: Joi.string().trim().lowercase().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(50).required().messages({
    'any.required': 'Role name is required'
  }),
  description: Joi.string().allow('', null).default(''),
  scope: Joi.string().valid('all', 'districts', 'own').default('own'),
  matrix: Joi.object().optional()
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  description: Joi.string().allow('', null),
  scope: Joi.string().valid('all', 'districts', 'own')
}).min(1);

export const updatePermissionSchema = Joi.object({
  matrix: Joi.object().optional(),
  module: Joi.string().when('matrix', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  action: Joi.string().valid('view', 'create', 'edit', 'delete', 'export').optional(),
  value: Joi.boolean().optional(),
  canView: Joi.boolean().optional(),
  canCreate: Joi.boolean().optional(),
  canEdit: Joi.boolean().optional(),
  canDelete: Joi.boolean().optional(),
  canExport: Joi.boolean().optional()
});
