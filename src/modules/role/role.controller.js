import { ok, created, badRequest, notFound, serverError } from '../../helpers/response.helper.js';
import * as roleService from './role.service.js';
import { createRoleSchema, updateRoleSchema, updatePermissionSchema } from './role.validation.js';

export const getRoles = async (req, res) => {
  try {
    const roles = await roleService.fetchAllRoles();
    return ok(res, 'Roles fetched successfully', roles);
  } catch (error) {
    return serverError(res, 'Failed to fetch roles', error);
  }
};

export const getRoleById = async (req, res) => {
  try {
    const role = await roleService.fetchRoleById(req.params.id);
    return ok(res, 'Role fetched successfully', role);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to fetch role', error);
  }
};

export const createRole = async (req, res) => {
  try {
    const { error, value } = createRoleSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const newRole = await roleService.createRole(value);
    return created(res, 'Role created successfully', newRole);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    return serverError(res, 'Failed to create role', error);
  }
};

export const updateRole = async (req, res) => {
  try {
    const { error, value } = updateRoleSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const updated = await roleService.updateRole(req.params.id, value);
    return ok(res, 'Role updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update role', error);
  }
};

export const setRolePermission = async (req, res) => {
  try {
    const { error, value } = updatePermissionSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const updated = await roleService.updateRolePermission(req.params.id, value);
    return ok(res, 'Role permission updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update role permission', error);
  }
};

export const deleteRole = async (req, res) => {
  try {
    const result = await roleService.deleteRole(req.params.id);
    return ok(res, result.message);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to delete role', error);
  }
};

