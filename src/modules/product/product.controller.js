import { ok, created, badRequest, serverError, paginated } from '../../helpers/response.helper.js';
import * as productService from './product.service.js';
import { createProductSchema } from './product.validation.js';
import { paginationQuerySchema } from '../../validations/common.validation.js';

export const getProducts = async (req, res) => {
  try {
    const { error: queryErr } = paginationQuerySchema.validate(req.query, { abortEarly: false, stripUnknown: false });
    if (queryErr) {
      return badRequest(res, queryErr.details.map(d => d.message).join(', '));
    }

    const { kind, search, page = 1, limit = 50 } = req.query;
    const result = await productService.fetchProducts({ kind, search, page, limit });

    return paginated(res, {
      items: result.products,
      total: result.total,
      page: result.pageNum,
      limit: result.limitNum,
      message: 'Products fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch catalogue products', error);
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
