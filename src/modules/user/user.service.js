import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Role, Lead, SuperAdmin } from '../../models/index.js';

export const fetchUsers = async ({ roleId, branchId, active, search, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (roleId) query.roleId = roleId;
  if (branchId) query.branchId = branchId;
  if (typeof active !== 'undefined' && active !== '') {
    query.active = active === 'true' || active === true;
  }
  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { mobile: { $regex: s, $options: 'i' } }
    ];
  }

  const [total, users, superAdmins] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .populate('roleId', 'name scope isSystem')
      .populate('branchId', 'name code')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SuperAdmin.find().select('name email').lean()
  ]);

  // Collect all managers to resolve names
  const managerIds = [...new Set(users.map(u => u.managerId).filter(Boolean))];
  const validObjectIds = managerIds.filter(id => mongoose.isValidObjectId(id));
  const userManagers = validObjectIds.length > 0 
    ? await User.find({ _id: { $in: validObjectIds } }).select('name email').lean()
    : [];

  const managerNameMap = new Map();
  userManagers.forEach(m => managerNameMap.set(m._id.toString(), m.name));
  superAdmins.forEach(sa => {
    managerNameMap.set(sa._id.toString(), sa.name);
    managerNameMap.set('U0', sa.name);
    managerNameMap.set('super_admin', sa.name);
  });

  const mappedUsers = users.map(u => {
    const mgrIdStr = u.managerId?.toString();
    const reportsToName = mgrIdStr ? (managerNameMap.get(mgrIdStr) || (typeof u.managerId === 'object' ? u.managerId.name : null)) : null;

    return {
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      roleId: u.roleId?._id?.toString() || u.roleId,
      roleName: u.roleId?.name || 'User',
      branchId: u.branchId?._id?.toString() || null,
      branchName: u.branchId?.name || '—',
      managerId: mgrIdStr || null,
      reportsTo: reportsToName,
      active: u.active,
      mobileAccess: u.mobileAccess,
      districts: u.districts || [],
      createdAt: u.createdAt
    };
  });

  const superAdminList = (!roleId && !branchId && pageNum === 1) ? superAdmins.map(sa => ({
    id: sa._id.toString(),
    _id: sa._id.toString(),
    name: `${sa.name} (Owner)`,
    email: sa.email,
    mobile: sa.mobile || '9000000000',
    roleId: 'super_admin',
    roleName: '—',
    branchId: null,
    branchName: 'Bengaluru',
    managerId: null,
    reportsTo: '—',
    active: true,
    mobileAccess: true,
    districts: [],
    createdAt: sa.createdAt || new Date(0)
  })) : [];

  return {
    users: [...superAdminList, ...mappedUsers],
    total: total + superAdminList.length,
    pageNum,
    limitNum,
    totalPages: Math.ceil((total + superAdminList.length) / limitNum)
  };
};

export const createNewUser = async (data) => {
  const { name, email, password, mobile, phone, roleId, roleName, branchId, managerId, districts, active, mobileAccess } = data;

  const cleanEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: cleanEmail });
  if (existing) {
    const error = new Error('A user with this email already exists');
    error.statusCode = 400;
    throw error;
  }

  let resolvedRoleId = roleId;
  if (!resolvedRoleId && roleName) {
    const role = await Role.findOne({ name: roleName });
    resolvedRoleId = role?._id;
  }

  if (!resolvedRoleId) {
    const error = new Error('Valid role is required');
    error.statusCode = 400;
    throw error;
  }

  // Resolve managerId if it's U0 or Super Admin
  let resolvedManagerId = managerId || null;
  if (resolvedManagerId === 'U0' || resolvedManagerId === 'super_admin') {
    const sa = await SuperAdmin.findOne();
    if (sa) resolvedManagerId = sa._id.toString();
  }

  // Resolve branchId to a valid MongoDB Branch ObjectId
  let resolvedBranchId = null;
  if (branchId) {
    if (mongoose.isValidObjectId(branchId)) {
      resolvedBranchId = branchId;
    } else {
      const bCode = branchId === 'B1' ? 'DEL' : branchId === 'B2' ? 'MUM' : branchId === 'B3' ? 'BLR' : String(branchId).toUpperCase();
      const { Branch } = await import('../../models/branch.model.js');
      const br = await Branch.findOne({ $or: [{ code: bCode }, { name: new RegExp(branchId, 'i') }] });
      if (br) resolvedBranchId = br._id;
    }
  }

  const userMobile = (mobile || phone || '').trim() || `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const passwordHash = await bcrypt.hash(password || 'meeraco@123', 10);

  const newUser = await User.create({
    name: name.trim(),
    email: cleanEmail,
    password: passwordHash,
    mobile: userMobile,
    roleId: resolvedRoleId,
    branchId: resolvedBranchId,
    managerId: resolvedManagerId,
    districts: districts || [],
    active: typeof active === 'boolean' ? active : true,
    mobileAccess: typeof mobileAccess === 'boolean' ? mobileAccess : true
  });

  const populated = await User.findById(newUser._id)
    .populate('roleId', 'name scope')
    .populate('branchId', 'name code')
    .lean();

  let reportsToName = null;
  if (resolvedManagerId) {
    if (mongoose.isValidObjectId(resolvedManagerId)) {
      const mgr = await User.findById(resolvedManagerId).select('name').lean()
        || await SuperAdmin.findById(resolvedManagerId).select('name').lean();
      reportsToName = mgr?.name || null;
    }
  }

  return {
    id: populated._id.toString(),
    name: populated.name,
    email: populated.email,
    mobile: populated.mobile,
    roleId: populated.roleId?._id?.toString(),
    roleName: populated.roleId?.name,
    branchId: populated.branchId?._id?.toString(),
    branchName: populated.branchId?.name || '—',
    managerId: resolvedManagerId ? resolvedManagerId.toString() : null,
    reportsTo: reportsToName,
    active: populated.active,
    mobileAccess: populated.mobileAccess
  };
};

export const updateExistingUser = async (id, data) => {
  const existing = await User.findById(id);
  if (!existing) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.email) updateData.email = data.email.toLowerCase().trim();
  if (data.mobile || data.phone) updateData.mobile = (data.mobile || data.phone).trim();
  if (typeof data.active !== 'undefined') updateData.active = Boolean(data.active);
  if (typeof data.mobileAccess !== 'undefined') updateData.mobileAccess = Boolean(data.mobileAccess);
  if (typeof data.branchId !== 'undefined') {
    let resolvedBranchId = null;
    if (data.branchId) {
      if (mongoose.isValidObjectId(data.branchId)) {
        resolvedBranchId = data.branchId;
      } else {
        const bCode = data.branchId === 'B1' ? 'DEL' : data.branchId === 'B2' ? 'MUM' : data.branchId === 'B3' ? 'BLR' : String(data.branchId).toUpperCase();
        const { Branch } = await import('../../models/branch.model.js');
        const br = await Branch.findOne({ $or: [{ code: bCode }, { name: new RegExp(data.branchId, 'i') }] });
        if (br) resolvedBranchId = br._id;
      }
    }
    updateData.branchId = resolvedBranchId;
  }
  if (typeof data.managerId !== 'undefined') {
    let resolvedManagerId = data.managerId || null;
    if (resolvedManagerId === 'U0' || resolvedManagerId === 'super_admin') {
      const sa = await SuperAdmin.findOne();
      if (sa) resolvedManagerId = sa._id.toString();
    }
    updateData.managerId = resolvedManagerId;
  }
  if (data.districts) updateData.districts = data.districts;

  if (data.password && data.password.trim()) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  if (data.roleId) {
    updateData.roleId = data.roleId;
  } else if (data.roleName) {
    const role = await Role.findOne({ name: data.roleName });
    if (role) updateData.roleId = role._id;
  }

  const updated = await User.findByIdAndUpdate(id, { $set: updateData }, { new: true })
    .populate('roleId', 'name scope')
    .populate('branchId', 'name code')
    .lean();

  let reportsToName = null;
  const currentMgrId = updated.managerId;
  if (currentMgrId) {
    if (mongoose.isValidObjectId(currentMgrId)) {
      const mgr = await User.findById(currentMgrId).select('name').lean()
        || await SuperAdmin.findById(currentMgrId).select('name').lean();
      reportsToName = mgr?.name || null;
    }
  }

  return {
    id: updated._id.toString(),
    name: updated.name,
    email: updated.email,
    mobile: updated.mobile,
    roleId: updated.roleId?._id?.toString(),
    roleName: updated.roleId?.name,
    branchId: updated.branchId?._id?.toString(),
    branchName: updated.branchId?.name || '—',
    managerId: currentMgrId ? currentMgrId.toString() : null,
    reportsTo: reportsToName,
    active: updated.active,
    mobileAccess: updated.mobileAccess
  };
};

export const changeUserStatus = async (id, active, reassignToUserId) => {
  const existing = await User.findById(id);
  if (!existing) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (!active && reassignToUserId) {
    await Lead.updateMany(
      { assignedToId: id, status: { $nin: ['Won', 'Lost', 'Dropped'] } },
      { $set: { assignedToId: reassignToUserId } }
    );
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { $set: { active: Boolean(active) } },
    { new: true, select: 'name email active' }
  );

  return updated;
};
