import mongoose from 'mongoose';
import { Branch, User, SuperAdmin } from '../../models/index.js';

const DEFAULT_TERRITORIES = {
  DEL: [{ state: 'Delhi', districts: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'South Delhi', 'West Delhi'] }],
  MUM: [{ state: 'Maharashtra', districts: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Palghar'] }],
  BLR: [{ state: 'Karnataka', districts: ['Bangalore Urban', 'Bangalore Rural'] }]
};

export const fetchBranches = async ({ search, q, active, state, page = 1, limit = 10 } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const skip = (pageNum - 1) * limitNum;

  // Build dynamic MongoDB query using $and to prevent condition overwriting
  const conditions = [];

  if (typeof active !== 'undefined' && active !== '' && active !== 'all' && active !== null) {
    const isActive = String(active).toLowerCase() === 'true' || active === true;
    if (isActive) {
      conditions.push({
        $or: [
          { active: true },
          { active: 'true' },
          { active: { $exists: false } },
          { active: null }
        ]
      });
    } else {
      conditions.push({
        $or: [
          { active: false },
          { active: 'false' }
        ]
      });
    }
  }

  if (state && state !== 'all') {
    conditions.push({ state });
  }

  const searchTerm = (search || q || '').trim();
  if (searchTerm) {
    conditions.push({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { code: { $regex: searchTerm, $options: 'i' } },
        { city: { $regex: searchTerm, $options: 'i' } },
        { state: { $regex: searchTerm, $options: 'i' } },
        { gstin: { $regex: searchTerm, $options: 'i' } },
        { 'territories.districts': { $regex: searchTerm, $options: 'i' } }
      ]
    });
  }

  const query = conditions.length > 0 ? { $and: conditions } : {};

  // Count existing branches in MongoDB to seed initial standard branches if empty
  const existingCount = await Branch.countDocuments();
  if (existingCount === 0) {
    const initialBranches = [
      {
        name: 'Delhi NCR',
        code: 'DEL',
        address: 'Plot 42, Okhla Industrial Area Phase 2',
        city: 'New Delhi',
        state: 'Delhi',
        gstin: '07AABCM1234C1Z5',
        phone: '1140001000',
        email: 'delhi@meeraco.demo',
        territories: [
          { state: 'Delhi', districts: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'South Delhi', 'West Delhi'] },
          { state: 'Haryana', districts: ['Gurugram', 'Faridabad'] }
        ],
        active: true
      },
      {
        name: 'Mumbai',
        code: 'MUM',
        address: 'Unit 301, Solitaire Corporate Park, Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        gstin: '27AABCM1234C1Z1',
        phone: '2240001000',
        email: 'mumbai@meeraco.demo',
        territories: [
          { state: 'Maharashtra', districts: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Palghar'] }
        ],
        active: true
      },
      {
        name: 'Bengaluru',
        code: 'BLR',
        address: 'Plot 15, Peenya Industrial Area Phase 1',
        city: 'Bengaluru',
        state: 'Karnataka',
        gstin: '29AABCM1234C1Z7',
        phone: '8040001000',
        email: 'bengaluru@meeraco.demo',
        territories: [
          { state: 'Karnataka', districts: ['Bangalore Urban', 'Bangalore Rural'] }
        ],
        active: true
      }
    ];

    try {
      await Branch.insertMany(initialBranches);
    } catch (e) {
      console.warn('Initial branch insertion note:', e.message);
    }
  }

  // Count total matching branches in MongoDB
  const total = await Branch.countDocuments(query);

  // Fetch paginated branches from MongoDB
  const branches = await Branch.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const [users, superAdmins, allBranchesForLookup] = await Promise.all([
    User.find().select('branchId active name email roleId').lean(),
    SuperAdmin.find().select('name email').lean(),
    Branch.find().select('_id code name').lean()
  ]);

  // Backfill territories for any branch if empty
  for (const b of branches) {
    if (!b.territories || b.territories.length === 0) {
      if (DEFAULT_TERRITORIES[b.code]) {
        b.territories = DEFAULT_TERRITORIES[b.code];
        Branch.findByIdAndUpdate(b._id, { $set: { territories: b.territories } }).catch(() => {});
      } else if (b.state) {
        b.territories = [{ state: b.state, districts: [b.city || b.state] }];
        Branch.findByIdAndUpdate(b._id, { $set: { territories: b.territories } }).catch(() => {});
      }
    }
  }

  // Build branch lookup map for code & legacy ID resolution
  const branchLookup = new Map();
  allBranchesForLookup.forEach(b => {
    const idStr = b._id.toString();
    branchLookup.set(idStr, idStr);
    branchLookup.set(b.code.toUpperCase(), idStr);
    branchLookup.set(b.name.toLowerCase(), idStr);
  });
  branchLookup.set('b1', branchLookup.get('DEL'));
  branchLookup.set('b2', branchLookup.get('MUM'));
  branchLookup.set('b3', branchLookup.get('BLR'));

  // Dynamic user count per branch (only active users) + resolve legacy branch IDs
  const userCountMap = new Map();
  for (const u of users) {
    if (u.active) {
      let bId = u.branchId ? u.branchId.toString() : null;
      if (bId && !branchLookup.has(bId)) {
        const resolvedId = branchLookup.get(bId.toUpperCase()) || branchLookup.get(bId.toLowerCase());
        if (resolvedId) {
          bId = resolvedId;
          User.findByIdAndUpdate(u._id, { $set: { branchId: resolvedId } }).catch(() => {});
        }
      }
      if (bId && branchLookup.has(bId)) {
        const targetId = branchLookup.get(bId) || bId;
        userCountMap.set(targetId, (userCountMap.get(targetId) || 0) + 1);
      }
    }
  }

  // Dynamic manager name map
  const managerNameMap = new Map();
  users.forEach(u => managerNameMap.set(u._id.toString(), u.name));
  superAdmins.forEach(sa => {
    managerNameMap.set(sa._id.toString(), sa.name);
    managerNameMap.set('U0', sa.name);
    managerNameMap.set('super_admin', sa.name);
  });

  const mappedBranches = branches.map(b => {
    const idStr = b._id.toString();
    const mgrId = b.managerId ? b.managerId.toString() : null;
    return {
      id: idStr,
      name: b.name,
      code: b.code,
      address: b.address || '',
      city: b.city || '',
      state: b.state || '',
      gstin: b.gstin || '',
      phone: b.phone || '',
      email: b.email || '',
      managerId: mgrId,
      managerName: mgrId ? (managerNameMap.get(mgrId) || '—') : '—',
      userCount: userCountMap.get(idStr) || 0,
      territories: Array.isArray(b.territories) ? b.territories : [],
      active: b.active !== false
    };
  });

  return {
    branches: mappedBranches,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1
  };
};

export const fetchBranchById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error('Invalid branch ID format');
    error.statusCode = 400;
    throw error;
  }

  const branch = await Branch.findById(id).lean();
  if (!branch) {
    const error = new Error('Branch not found');
    error.statusCode = 404;
    throw error;
  }

  let managerName = '—';
  if (branch.managerId) {
    if (mongoose.isValidObjectId(branch.managerId)) {
      const mgr = await User.findById(branch.managerId).select('name').lean();
      if (mgr) managerName = mgr.name;
    }
    if (managerName === '—') {
      const sa = await SuperAdmin.findById(branch.managerId).select('name').lean();
      if (sa) managerName = sa.name;
    }
  }

  const users = await User.find({ branchId: id, active: true }).select('name email roleId').lean();

  return {
    id: branch._id.toString(),
    name: branch.name,
    code: branch.code,
    address: branch.address || '',
    city: branch.city || '',
    state: branch.state || '',
    gstin: branch.gstin || '',
    phone: branch.phone || '',
    email: branch.email || '',
    managerId: branch.managerId ? branch.managerId.toString() : null,
    managerName,
    userCount: users.length,
    users: users.map(u => ({ id: u._id.toString(), name: u.name, email: u.email })),
    territories: Array.isArray(branch.territories) ? branch.territories : [],
    active: branch.active !== false
  };
};

export const createNewBranch = async (data) => {
  const { name, code, address, city, state, gstin, phone, email, managerId, territories } = data;
  const cleanCode = code.toUpperCase().trim();

  const existing = await Branch.findOne({ code: cleanCode });
  if (existing) {
    const error = new Error(`Branch code '${cleanCode}' is already taken`);
    error.statusCode = 400;
    throw error;
  }

  // Resolve managerId if it's U0 or Super Admin
  let resolvedManagerId = managerId || null;
  if (resolvedManagerId === 'U0' || resolvedManagerId === 'super_admin') {
    const sa = await SuperAdmin.findOne();
    if (sa) resolvedManagerId = sa._id.toString();
  }

  const branch = await Branch.create({
    name: name.trim(),
    code: cleanCode,
    address: address || '',
    city: city || '',
    state: state || '',
    gstin: gstin || '',
    phone: phone || '',
    email: email || '',
    managerId: resolvedManagerId,
    territories: Array.isArray(territories) ? territories : [],
    active: true
  });

  // Assign this branch to the manager's user record in MongoDB & resolve managerName
  let managerName = '—';
  if (resolvedManagerId) {
    if (mongoose.isValidObjectId(resolvedManagerId)) {
      await User.findByIdAndUpdate(resolvedManagerId, { $set: { branchId: branch._id } });
      const mgr = await User.findById(resolvedManagerId).select('name').lean();
      if (mgr) managerName = mgr.name;
    }
    if (managerName === '—') {
      const sa = await SuperAdmin.findById(resolvedManagerId).select('name').lean();
      if (sa) managerName = sa.name;
    }
  }

  return {
    id: branch._id.toString(),
    name: branch.name,
    code: branch.code,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    gstin: branch.gstin,
    phone: branch.phone,
    email: branch.email,
    managerId: branch.managerId,
    managerName,
    territories: branch.territories,
    active: branch.active
  };
};

export const updateExistingBranch = async (id, data) => {
  const existing = await Branch.findById(id);
  if (!existing) {
    const error = new Error('Branch not found');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.code) {
    const cleanCode = data.code.toUpperCase().trim();
    const dup = await Branch.findOne({ code: cleanCode, _id: { $ne: id } });
    if (dup) {
      const error = new Error(`Branch code '${cleanCode}' is already taken`);
      error.statusCode = 400;
      throw error;
    }
    updateData.code = cleanCode;
  }
  if (typeof data.address !== 'undefined') updateData.address = data.address || '';
  if (data.city) updateData.city = data.city.trim();
  if (data.state) updateData.state = data.state.trim();
  if (typeof data.gstin !== 'undefined') updateData.gstin = data.gstin || '';
  if (typeof data.phone !== 'undefined') updateData.phone = data.phone || '';
  if (typeof data.email !== 'undefined') updateData.email = data.email || '';
  if (typeof data.managerId !== 'undefined') {
    let resolvedManagerId = data.managerId || null;
    if (resolvedManagerId === 'U0' || resolvedManagerId === 'super_admin') {
      const sa = await SuperAdmin.findOne();
      if (sa) resolvedManagerId = sa._id.toString();
    }
    updateData.managerId = resolvedManagerId;
    if (resolvedManagerId && mongoose.isValidObjectId(resolvedManagerId)) {
      await User.findByIdAndUpdate(resolvedManagerId, { $set: { branchId: id } });
    }
  }
  if (Array.isArray(data.territories)) updateData.territories = data.territories;
  if (typeof data.active !== 'undefined') updateData.active = Boolean(data.active);

  const updated = await Branch.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();

  let managerName = '—';
  if (updated.managerId) {
    if (mongoose.isValidObjectId(updated.managerId)) {
      const mgr = await User.findById(updated.managerId).select('name').lean();
      if (mgr) managerName = mgr.name;
    }
    if (managerName === '—') {
      const sa = await SuperAdmin.findById(updated.managerId).select('name').lean();
      if (sa) managerName = sa.name;
    }
  }

  return {
    id: updated._id.toString(),
    name: updated.name,
    code: updated.code,
    address: updated.address,
    city: updated.city,
    state: updated.state,
    gstin: updated.gstin,
    phone: updated.phone,
    email: updated.email,
    managerId: updated.managerId,
    managerName,
    territories: updated.territories,
    active: updated.active
  };
};

export const changeBranchStatus = async (id, active) => {
  const existing = await Branch.findById(id);
  if (!existing) {
    const error = new Error('Branch not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await Branch.findByIdAndUpdate(
    id,
    { $set: { active: Boolean(active) } },
    { new: true }
  ).lean();

  return {
    id: updated._id.toString(),
    active: updated.active
  };
};

export const removeBranch = async (id) => {
  const branch = await Branch.findById(id);
  if (!branch) {
    const error = new Error('Branch not found');
    error.statusCode = 404;
    throw error;
  }

  // Unassign users from this branch so they are not orphaned
  await User.updateMany({ branchId: id }, { $set: { branchId: null } });

  await Branch.findByIdAndDelete(id);
  return { id, name: branch.name };
};
