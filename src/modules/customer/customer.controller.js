import { ok, created, badRequest, notFound, serverError, paginated } from '../../helpers/response.helper.js';
import * as customerService from './customer.service.js';
import { createCustomerSchema, updateCustomerSchema, addContactSchema } from './customer.validation.js';

export const getCustomers = async (req, res) => {
  try {
    const { search, branchId, status, page = 1, limit = 10 } = req.query;
    const result = await customerService.fetchCustomers({
      search,
      branchId,
      status,
      page,
      limit,
      user: req.user
    });

    return paginated(res, {
      items: result.customers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      message: 'Customers fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch customers', error);
  }
};

export const getCustomerById = async (req, res) => {
  try {
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

export const updateCustomer = async (req, res) => {
  try {
    const { error, value } = updateCustomerSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const updated = await customerService.updateExistingCustomer(req.params.id, value, req.user);
    return ok(res, 'Customer updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update customer', error);
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const result = await customerService.deleteExistingCustomer(req.params.id, req.user);
    return ok(res, 'Customer deleted successfully', result);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to delete customer', error);
  }
};

export const addCustomerContact = async (req, res) => {
  try {
    const { error, value } = addContactSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const contact = await customerService.createContact(req.params.id, value);
    return created(res, 'Contact added successfully', contact);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to add customer contact', error);
  }
};
