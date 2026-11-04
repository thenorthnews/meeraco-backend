import { ok, created, badRequest, notFound, serverError, paginated } from '../../helpers/response.helper.js';
import * as productService from './product.service.js';
import { createProductSchema, updateProductSchema } from './product.validation.js';

export const getProducts = async (req, res) => {
  try {
    const { kind, active, search, q, page = 1, limit = 10, sort = 'kva', dir = 1 } = req.query;
    const result = await productService.fetchProducts({
      kind,
      active,
      search: search || q,
      page,
      limit,
      sort,
      dir
    });

    return paginated(res, {
      items: result.products,
      total: result.total,
      page: result.page,
      limit: result.limit,
      message: 'Products fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch catalogue products', error);
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await productService.fetchProductById(req.params.id);
    return ok(res, 'Product fetched successfully', product);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to fetch product', error);
  }
};

export const createProduct = async (req, res) => {
  try {
    const { error, value } = createProductSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const product = await productService.createNewProduct(value);
    return created(res, 'Product added to catalogue successfully', product);
  } catch (error) {
    if (error.statusCode === 400) {
      return badRequest(res, error.message);
    }
    return serverError(res, 'Failed to create product', error);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { error, value } = updateProductSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const updated = await productService.updateExistingProduct(req.params.id, value);
    return ok(res, 'Product updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update product', error);
  }
};

export const setProductStatus = async (req, res) => {
  try {
    const { active } = req.body;
    const updated = await productService.changeProductStatus(req.params.id, active);
    return ok(res, `Product status updated to ${active ? 'active' : 'inactive'}`, updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update product status', error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const result = await productService.removeProduct(req.params.id);
    return ok(res, `Product '${result.name}' deleted successfully`, result);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to delete product', error);
  }
};

export const bulkImport = async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items;
    const result = await productService.bulkCreateProducts(items);
    return ok(res, `${result.importedCount} items imported into catalogue successfully`, result);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    return serverError(res, 'Failed to bulk import products', error);
  }
};
