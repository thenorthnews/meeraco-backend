import { ok, created, badRequest, notFound, forbidden, serverError, paginated } from '../../helpers/response.helper.js';
import * as leadService from './lead.service.js';
import { createLeadSchema, updateLeadStageSchema, reassignLeadSchema } from './lead.validation.js';
import { paginationQuerySchema, idParamSchema } from '../../validations/common.validation.js';

export const getLeads = async (req, res) => {
  try {
    const { error: queryErr } = paginationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (queryErr) {
      return badRequest(res, queryErr.details.map(d => d.message).join(', '));
    }

    const { stage, branchId, assignedToId, search, page = 1, limit = 50 } = req.query;
    const result = await leadService.fetchLeads({
      stage,
      branchId,
      assignedToId,
      search,
      page,
      limit,
      user: req.user
    });

    return paginated(res, {
      items: result.leads,
      total: result.total,
      page: result.pageNum,
      limit: result.limitNum,
      message: 'Leads fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch leads', error);
  }
};

export const getLeadById = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const lead = await leadService.fetchLeadById(req.params.id, req.user);
    return ok(res, 'Lead details fetched successfully', lead);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    if (error.statusCode === 403) return forbidden(res, error.message);
    return serverError(res, 'Failed to fetch lead', error);
  }
};

export const createLead = async (req, res) => {
  try {
    const { error, value } = createLeadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const lead = await leadService.createNewLead(value, req.user);
    return created(res, 'Lead created and routed successfully', lead);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    return serverError(res, 'Failed to create lead', error);
  }
};

export const updateLeadStage = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = updateLeadStageSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await leadService.updateStage(req.params.id, value, req.user);
    return ok(res, `Lead stage updated to '${value.stage}'`, updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update lead stage', error);
  }
};

export const reassignLead = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = reassignLeadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await leadService.reassign(req.params.id, value, req.user);
    return ok(res, 'Lead reassigned successfully', updated);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to reassign lead', error);
  }
};
