import { ok, created, badRequest, notFound, serverError, paginated } from '../../helpers/response.helper.js';
import * as customerService from './customer.service.js';
import { createCustomerSchema, addContactSchema } from './customer.validation.js';
import { paginationQuerySchema, idParamSchema } from '../../validations/common.validation.js';

export const getCustomers = async (req, res) => {
  try {
    const { error: queryErr } = paginationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (queryErr) {
      return badRequest(res, queryErr.details.map(d => d.message).join(', '));
    }

    const { search, branchId, page = 1, limit = 50 } = req.query;
    const result = await customerService.fetchCustomers({
      search,
      branchId,
      page,
      limit,
      user: req.user
    });

    return paginated(res, {
      items: result.customers,
      total: result.total,
      page: result.pageNum,
      limit: result.limitNum,
      message: 'Customers fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch customers', error);
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const customer = await customerService.fetchCustomerById(req.params.id);
    return ok(res, 'Customer details fetched successfully', customer);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to fetch customer', error);
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { error, value } = createCustomerSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const customer = await customerService.createNewCustomer(value, req.user);
    return created(res, 'Customer created successfully', customer);
  } catch (error) {
    return serverError(res, 'Failed to create customer', error);
  }
};

export const addCustomerContact = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = addContactSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const contact = await customerService.createContact(req.params.id, value);
    return created(res, 'Contact added successfully', contact);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to add customer contact', error);
  }
};
