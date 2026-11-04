import { ok, created, badRequest, notFound, serverError, paginated } from '../../helpers/response.helper.js';
import * as branchService from './branch.service.js';
import { createBranchSchema } from './branch.validation.js';

export const getBranches = async (req, res) => {
  try {
    const { search, q, active, state, page = 1, limit = 10 } = req.query;
    const result = await branchService.fetchBranches({
      search: search || q,
      active,
      state,
      page,
      limit
    });
    return paginated(res, {
      items: result.branches,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: 'Branches fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch branches', error);
  }
};

export const getBranchById = async (req, res) => {
  try {
    const branch = await branchService.fetchBranchById(req.params.id);
    return ok(res, 'Branch fetched successfully', branch);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    if (error.statusCode === 400) return badRequest(res, error.message);
    return serverError(res, 'Failed to fetch branch', error);
  }
};

export const createBranch = async (req, res) => {
  try {
    const { error, value } = createBranchSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const branch = await branchService.createNewBranch(value);
    return created(res, 'Branch created successfully', branch);
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(res, error.message);
    }
    return serverError(res, 'Failed to create branch', error);
  }
};

export const updateBranch = async (req, res) => {
  try {
    const updated = await branchService.updateExistingBranch(req.params.id, req.body);
    return ok(res, 'Branch updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update branch', error);
  }
};

export const setBranchStatus = async (req, res) => {
  try {
    const { active } = req.body;
    console.log("🚀 ~ setBranchStatus ~ active:", active)
    const updated = await branchService.changeBranchStatus(req.params.id, active);
    return ok(res, `Branch status updated to ${active ? 'active' : 'inactive'}`, updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to change branch status', error);
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const result = await branchService.removeBranch(req.params.id);
    return ok(res, `Branch '${result.name}' deleted successfully`, result);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to delete branch', error);
  }
};
