import mongoose from 'mongoose';
import { Notification, User, SuperAdmin } from '../../models/index.js';
import { getIO } from '../../socket/socket.js';

/**
 * Register or update device token for user
 */
export const registerDeviceToken = async (userId, { token, platform = 'web' } = {}) => {
  if (!token) return { success: false, message: 'Device token is required' };
  if (!userId) return { success: false, message: 'User ID is required' };

  let account = null;
  const isObjectId = mongoose.Types.ObjectId.isValid(userId);

  if (isObjectId) {
    account = await User.findById(userId);
    if (!account && SuperAdmin) {
      account = await SuperAdmin.findById(userId);
    }
  }

  if (!account) {
    // In dev or mock demo sessions (e.g. U0), acknowledge gracefully without error
    return { success: true, count: 1, token };
  }

  if (!account.deviceTokens) account.deviceTokens = [];

  const existingIdx = account.deviceTokens.findIndex(d => d.token === token);
  if (existingIdx !== -1) {
    account.deviceTokens[existingIdx].lastActiveAt = new Date();
    account.deviceTokens[existingIdx].platform = platform;
  } else {
    account.deviceTokens.push({ token, platform, registeredAt: new Date(), lastActiveAt: new Date() });
  }

  account.fcmToken = token;
  await account.save();

  return { success: true, count: account.deviceTokens.length, token };
};

/**
 * Create Notification & Emit Real-Time Socket
 */
export const createNotification = async ({
  userId,
  title,
  message,
  type = 'general',
  entityId = null,
  entityType = 'general',
  link = ''
}) => {
  if (!userId || !title || !message) return null;

  const notif = await Notification.create({
    userId,
    title,
    message,
    type,
    entityId,
    entityType,
    link,
    read: false
  });

  const unreadCount = await Notification.countDocuments({ userId, read: false });

  // Real-time Socket.IO emission to user room
  const io = getIO();
  if (io) {
    const payload = {
      notification: notif,
      unreadCount
    };
    io.to(`user:${userId.toString()}`).emit('notification:new', payload);
    io.emit('notification:broadcast', { userId: userId.toString(), unreadCount });
  }

  return { notif, unreadCount };
};

/**
 * Notify all Branch Managers & Admins (e.g. when quote awaits approval)
 */
export const notifyManagersAndAdmins = async ({
  branchId = null,
  title,
  message,
  type = 'quote_approval_needed',
  entityId = null,
  entityType = 'quotation',
  link = ''
}) => {
  const users = await User.find({ active: true }).populate('roleId').lean();
  const recipients = users.filter(u => {
    const rName = (u.roleId?.name || '').toLowerCase();
    const isOwnerOrAdmin = rName.includes('admin') || rName.includes('owner') || u.email === 'owner@meeraco.demo';
    const isBranchManager = rName.includes('manager') && (!branchId || String(u.branchId) === String(branchId));
    return isOwnerOrAdmin || isBranchManager;
  });

  const results = [];
  for (const recipient of recipients) {
    const res = await createNotification({
      userId: recipient._id,
      title,
      message,
      type,
      entityId,
      entityType,
      link
    });
    results.push(res);
  }

  return results;
};

/**
 * Fetch User Notifications with Unread Count
 */
export const fetchUserNotifications = async (userId, { limit = 30, page = 1 } = {}) => {
  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, read: false })
  ]);

  return {
    items,
    total,
    unreadCount,
    page: Number(page),
    limit: Number(limit)
  };
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true, readAt: new Date() },
    { new: true }
  );

  const unreadCount = await Notification.countDocuments({ userId, read: false });

  const io = getIO();
  if (io) {
    io.to(`user:${userId.toString()}`).emit('notification:count_updated', { unreadCount });
  }

  return { notif, unreadCount };
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() }
  );

  const io = getIO();
  if (io) {
    io.to(`user:${userId.toString()}`).emit('notification:count_updated', { unreadCount: 0 });
  }

  return { unreadCount: 0 };
};

