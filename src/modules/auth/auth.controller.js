import { ok, unauthorized, notFound, badRequest, serverError } from '../../helpers/response.helper.js';
import * as authService from './auth.service.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.validation.js';

export const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const { email, password } = value;
    const result = await authService.loginUser({ email, password });
    return ok(res, 'Login successful', result);
  } catch (error) {
    if (error.statusCode === 401) {
      return unauthorized(res, error.message);
    }
    return serverError(res, 'Authentication failed', error);
  }
};

export const getSuperAdminToken = async (req, res) => {
  try {
    const result = await authService.generateSuperAdminToken();
    return ok(res, 'Super Admin token generated successfully', result);
  } catch (error) {
    return serverError(res, 'Failed to generate Super Admin token', error);
  }
};

export const getMe = async (req, res) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    return ok(res, 'User profile fetched successfully', profile);
  } catch (error) {
    if (error.statusCode === 404) {
      return notFound(res, error.message);
    }
    return serverError(res, 'Failed to fetch user profile', error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updated = await authService.updateProfile(req.user.id, req.body);
    return ok(res, 'Profile updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update profile', error);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    await authService.requestPasswordReset(value.email);
    return ok(res, 'If your email is registered, a password reset link has been sent to your inbox.');
  } catch (error) {
    return serverError(res, 'Failed to process forgot password request', error);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const result = await authService.completePasswordReset(value.token, value.newPassword);
    return ok(res, 'Password has been reset successfully. You can now login with your new password.', result);
  } catch (error) {
    if (error.statusCode === 400) return badRequest(res, error.message);
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to reset password', error);
  }
};
