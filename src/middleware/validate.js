import { badRequest } from '../helpers/response.helper.js';

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const dataToValidate = req[source];
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
      errors: {
        wrap: {
          label: ''
        }
      }
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return badRequest(res, 'Validation Error', errorMessages);
    }

    req[source] = value;
    next();
  };
};
