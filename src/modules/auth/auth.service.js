import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, SuperAdmin } from '../../models/index.js';
import { sendOTPEmail, sendForgotPasswordEmail, sendPasswordResetSuccessEmail } from '../../helpers/email.helper.js';
import logger from '../../helpers/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'meeraco-crm-super-secret-key-2026';

// In-memory OTP storage for fast verification & expiry
const otpStore = new Map();

/**
 * 📲 Send OTP to registered mobile number
 */
export const sendPhoneOtp = async (rawPhone) => {
  const cleanPhone = String(rawPhone || '').replace(/\D/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    const error = new Error('Please enter a valid 10-digit mobile number');
    error.statusCode = 400;
    throw error;
  }

  // 1. Look for user with this mobile number in SuperAdmin or User collection
  const phonePattern = new RegExp(`${cleanPhone}$`);
  let user = await SuperAdmin.findOne({ mobile: phonePattern });
  let isSuperAdmin = false;

  if (user) {
    isSuperAdmin = true;
  } else {
    user = await User.findOne({ mobile: phonePattern }).populate('roleId').populate('branchId');
  }

  if (!user) {
    const error = new Error(`Mobile number +91 ${cleanPhone} is not registered. Please contact admin.`);
    error.statusCode = 404;
    throw error;
  }

  if (!isSuperAdmin && user.active === false) {
    const error = new Error('Your account is deactivated. Please contact your administrator.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Generate 6-digit OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  // 3. Store OTP in MongoDB (SuperAdmin or User document)
  if (isSuperAdmin) {
    await SuperAdmin.findByIdAndUpdate(user._id, {
      $set: { otp: code, otpExpiresAt: otpExpiry }
    });
  } else {
    await User.findByIdAndUpdate(user._id, {
      $set: { otp: code, otpExpiresAt: otpExpiry }
    });
  }

  logger.info(`[PHONE OTP STORED IN DB] Mobile: +91 ${cleanPhone} | Model: ${isSuperAdmin ? 'SuperAdmin' : 'User'} | Name: ${user.name} | OTP: ${code}`);

  if (user.email) {
    try {
      await sendOTPEmail(user.email, user.name, code);
    } catch (_) {}
  }

  return {
    mobile: cleanPhone,
    name: user.name,
    expiresIn: 600,
    message: `OTP sent successfully to +91 ${cleanPhone}`
  };
};

/**
 * 🔐 Verify OTP and authenticate user
 */
export const verifyPhoneOtp = async (rawPhone, otp) => {
  const cleanPhone = String(rawPhone || '').replace(/\D/g, '').slice(-10);
  const cleanOtp = String(otp || '').trim();

  if (!cleanPhone || cleanPhone.length !== 10) {
    const error = new Error('Please enter a valid 10-digit mobile number');
    error.statusCode = 400;
    throw error;
  }

  if (!cleanOtp || cleanOtp.length !== 6) {
    const error = new Error('Please enter a valid 6-digit OTP');
    error.statusCode = 400;
    throw error;
  }

  // 1. Look for user in SuperAdmin or User collection
  const phonePattern = new RegExp(`${cleanPhone}$`);
  let user = await SuperAdmin.findOne({ mobile: phonePattern });
  let isSuperAdmin = false;

  if (user) {
    isSuperAdmin = true;
  } else {
    user = await User.findOne({ mobile: phonePattern }).populate('roleId').populate('branchId');
  }

  if (!user) {
    const error = new Error('User not found with this mobile number');
    error.statusCode = 404;
    throw error;
  }

  if (!isSuperAdmin && user.active === false) {
    const error = new Error('Your account is deactivated. Please contact your administrator.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Verify OTP against MongoDB record or static 111111 / 222222
  const isMatchDb = Boolean(
    user.otp &&
    user.otp === cleanOtp &&
    user.otpExpiresAt &&
    new Date() <= new Date(user.otpExpiresAt)
  );
  const isStatic = cleanOtp === '111111' || cleanOtp === '222222';

  if (!isMatchDb && !isStatic) {
    const error = new Error('Invalid or expired OTP. Click "Send OTP again" to receive a new code.');
    error.statusCode = 400;
    throw error;
  }

  // 3. 🗑️ Delete / Clear OTP from MongoDB upon successful verification
  if (isSuperAdmin) {
    await SuperAdmin.findByIdAndUpdate(user._id, {
      $set: { otp: null, otpExpiresAt: null, lastLoginAt: new Date() }
    });
  } else {
    await User.findByIdAndUpdate(user._id, {
      $set: { otp: null, otpExpiresAt: null, lastLoginAt: new Date() }
    });
  }

  logger.info(`[OTP VERIFIED & DELETED FROM DB] Mobile: +91 ${cleanPhone} | User: ${user.name}`);

  const roleName = isSuperAdmin ? 'Super Admin' : (user.roleId?.name || 'User');
  const userId = user._id.toString();

  const token = jwt.sign(
    {
      id: userId,
      userId: userId,
      email: user.email,
      role: roleName,
      branchId: user.branchId?._id?.toString() || null
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  logger.info(`User logged in via OTP: ${user.name} (+91 ${cleanPhone}) [${roleName}]`);

  return {
    user: {
      id: userId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: roleName,
      roleId: isSuperAdmin ? 'super_admin' : user.roleId?._id?.toString(),
      branch: user.branchId ? { id: user.branchId._id, name: user.branchId.name, code: user.branchId.code } : null
    },
    token
  };
};

export const loginUser = async ({ email, password }) => {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Check in SuperAdmin model first
  let user = await SuperAdmin.findOne({ email: cleanEmail });
  let isSuperAdmin = false;

  if (user) {
    isSuperAdmin = true;
  } else {
    // 2. Check in User model
    user = await User.findOne({ email: cleanEmail }).populate('roleId').populate('branchId');
  }

  if (!user || (!user.active && !isSuperAdmin)) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const roleName = isSuperAdmin ? 'Super Admin' : (user.roleId?.name || 'User');
  const userId = user._id.toString();

  const token = jwt.sign(
    {
      id: userId,
      userId: userId,
      email: user.email,
      role: roleName,
      branchId: user.branchId?._id?.toString() || null
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  logger.info(`User logged in: ${user.email} (${roleName})`);

  return {
    user: {
      id: userId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: roleName,
      roleId: isSuperAdmin ? 'super_admin' : user.roleId?._id?.toString(),
      branch: user.branchId ? { id: user.branchId._id, name: user.branchId.name, code: user.branchId.code } : null
    },
    token
  };
};

export const generateSuperAdminToken = async () => {
  const superAdmin = await SuperAdmin.findOne();
  if (!superAdmin) {
    const error = new Error('Super Admin account not found in database');
    error.statusCode = 404;
    throw error;
  }

  const userId = superAdmin._id.toString();
  const token = jwt.sign(
    {
      id: userId,
      userId: userId,
      email: superAdmin.email,
      role: 'Super Admin',
      branchId: null
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );

  return {
    user: {
      id: userId,
      name: superAdmin.name,
      email: superAdmin.email,
      mobile: superAdmin.mobile,
      role: 'Super Admin',
      roleId: 'super_admin',
      branch: null
    },
    token
  };
};

export const getProfile = async (userId) => {
  let user = await SuperAdmin.findById(userId);
  let isSuperAdmin = false;

  if (user) {
    isSuperAdmin = true;
  } else {
    user = await User.findById(userId).populate('roleId').populate('branchId');
  }

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const roleName = isSuperAdmin ? 'Super Admin' : (user.roleId?.name || 'User');

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    phone: user.mobile,
    role: roleName,
    roleId: isSuperAdmin ? 'super_admin' : user.roleId?._id?.toString(),
    branch: user.branchId ? { id: user.branchId._id, name: user.branchId.name, code: user.branchId.code } : null
  };
};

export const updateProfile = async (userId, data) => {
  const updateData = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.mobile || data.phone) updateData.mobile = (data.mobile || data.phone).trim();
  if (data.password && data.password.trim()) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  let user = await SuperAdmin.findById(userId);
  let isSuperAdmin = false;

  if (user) {
    isSuperAdmin = true;
    user = await SuperAdmin.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
  } else {
    user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).populate('roleId').populate('branchId');
  }

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const roleName = isSuperAdmin ? 'Super Admin' : (user.roleId?.name || 'User');

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    phone: user.mobile,
    role: roleName,
    roleId: isSuperAdmin ? 'super_admin' : user.roleId?._id?.toString(),
    branch: user.branchId ? { id: user.branchId._id, name: user.branchId.name, code: user.branchId.code } : null
  };
};

export const requestPasswordReset = async (email) => {
  const cleanEmail = email.toLowerCase().trim();
  let user = await SuperAdmin.findOne({ email: cleanEmail });
  if (!user) {
    user = await User.findOne({ email: cleanEmail });
  }

  if (!user) {
    return { message: 'Reset link sent' };
  }

  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  user.resetToken = token;
  user.resetTokenExpiry = expiry;
  await user.save();

  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  try {
    await sendForgotPasswordEmail(user.email, user.name, resetUrl);
  } catch (err) {
    logger.error(`Reset email failed: ${err.message}`);
  }

  return { message: 'Reset link sent successfully' };
};

export const completePasswordReset = async ({ token, password }) => {
  let user = await SuperAdmin.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: new Date() }
  });

  if (!user) {
    user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });
  }

  if (!user) {
    const error = new Error('Password reset token is invalid or has expired');
    error.statusCode = 400;
    throw error;
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();

  try {
    await sendPasswordResetSuccessEmail(user.email, user.name);
  } catch (err) {
    logger.error(`Confirmation email failed: ${err.message}`);
  }

  return { message: 'Password reset successful. You may now log in.' };
};
