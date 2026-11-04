import { ok, created, badRequest, notFound, serverError, paginated } from '../../helpers/response.helper.js';
import * as quotationService from './quotation.service.js';
import { createQuotationSchema, updateQuotationStatusSchema } from './quotation.validation.js';
import { paginationQuerySchema, idParamSchema } from '../../validations/common.validation.js';

export const getQuotations = async (req, res) => {
  try {
    const { error: queryErr } = paginationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (queryErr) {
      return badRequest(res, queryErr.details.map(d => d.message).join(', '));
    }

    const { status, customerId, leadId, branchId, page = 1, limit = 50 } = req.query;
    const result = await quotationService.fetchQuotations({
      status,
      customerId,
      leadId,
      branchId,
      page,
      limit,
      user: req.user
    });

    return paginated(res, {
      items: result.quotations,
      total: result.total,
      page: result.pageNum,
      limit: result.limitNum,
      message: 'Quotations fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch quotations', error);
  }
};

export const createQuotation = async (req, res) => {
  try {
    const { error, value } = createQuotationSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const quotation = await quotationService.createNewQuotation(value, req.user);
    return created(res, 'Quotation generated successfully', quotation);
  } catch (error) {
    return serverError(res, 'Failed to create quotation', error);
  }
};

export const updateQuotationStatus = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = updateQuotationStatusSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await quotationService.changeQuotationStatus(req.params.id, value.status, value.notes);
    return ok(res, `Quotation status updated to '${value.status}'`, updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update quotation status', error);
  }
};
