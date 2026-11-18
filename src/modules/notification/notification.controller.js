import { ok, created, badRequest, notFound, serverError } from '../../helpers/response.helper.js';
import * as notifService from './notification.service.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return badRequest(res, 'Authentication required');

    const { limit = 30, page = 1 } = req.query;
    const result = await notifService.fetchUserNotifications(userId, { limit, page });

    return ok(res, 'Notifications fetched successfully', result);
  } catch (error) {
    return serverError(res, 'Failed to fetch notifications', error);
  }
};

export const registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return badRequest(res, 'Authentication required');

    const { token, platform = 'web' } = req.body;
    if (!token) return badRequest(res, 'Device token is required');

    const result = await notifService.registerDeviceToken(userId, { token, platform });
    return ok(res, 'Device token registered successfully', result);
  } catch (error) {
    return serverError(res, 'Failed to register device token', error);
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;

    const result = await notifService.markAsRead(id, userId);
    return ok(res, 'Notification marked as read', result);
  } catch (error) {
    return serverError(res, 'Failed to update notification', error);
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const result = await notifService.markAllAsRead(userId);
    return ok(res, 'All notifications marked as read', result);
  } catch (error) {
    return serverError(res, 'Failed to mark notifications read', error);
  }
};

