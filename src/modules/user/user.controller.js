import { ok, created, badRequest, notFound, serverError, paginated } from '../../helpers/response.helper.js';
import * as userService from './user.service.js';
import { createUserSchema, updateUserSchema, setUserStatusSchema } from './user.validation.js';
import { paginationQuerySchema, idParamSchema } from '../../validations/common.validation.js';

export const getUsers = async (req, res) => {
  try {
    const { error: queryErr } = paginationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (queryErr) {
      return badRequest(res, queryErr.details.map(d => d.message).join(', '));
    }

    const { roleId, role, branchId, active, search, page = 1, limit = 50 } = req.query;
    const result = await userService.fetchUsers({ roleId: roleId || role, branchId, active, search, page, limit });

    return paginated(res, {
      items: result.users,
      total: result.total,
      page: result.pageNum,
      limit: result.limitNum,
      message: 'Users fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch users', error);
  }
};

export const createUser = async (req, res) => {
  try {
    const { error, value } = createUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const newUser = await userService.createNewUser(value);
    return created(res, 'User created successfully', newUser);
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(res, error.message);
    }
    return serverError(res, 'Failed to create user', error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = updateUserSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await userService.updateExistingUser(req.params.id, value);
    return ok(res, 'User updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update user', error);
  }
};

export const setUserActiveStatus = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = setUserStatusSchema.validate(req.body, { abortEarly: false });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await userService.changeUserStatus(req.params.id, value.active);
    return ok(res, `User status updated to ${updated.active ? 'active' : 'inactive'}`, updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to change user status', error);
  }
};
