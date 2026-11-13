import Joi from 'joi';

export const createRoleSchema = Joi.object({
  id: Joi.string().trim().lowercase().allow('', null).optional(),
  name: Joi.string().trim().min(2).max(50).required().messages({
    'any.required': 'Role name is required'
  }),
  description: Joi.string().allow('', null).default(''),
  scope: Joi.string().valid('all', 'districts', 'own').default('own'),
  matrix: Joi.object().optional(),
  permissionsList: Joi.array().items(Joi.string()).optional(),
  simplifiedPermissions: Joi.object().optional()
}).unknown(true);

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional(),
  description: Joi.string().allow('', null).optional(),
  scope: Joi.string().valid('all', 'districts', 'own').optional(),
  matrix: Joi.object().optional(),
  permissionsList: Joi.array().items(Joi.string()).optional(),
  simplifiedPermissions: Joi.object().optional()
}).unknown(true);

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
