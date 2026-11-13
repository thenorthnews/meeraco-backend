import mongoose from 'mongoose';
import { SuperAdmin, GeneralSetting, LeadMaster, AssignmentRule, Branch, User } from '../../models/index.js';

export const fetchCompanyProfile = async () => {
  return await SuperAdmin.findOne().lean();
};

export const saveCompanyProfile = async (data) => {
  return await SuperAdmin.findOneAndUpdate(
    {},
    { $set: data },
    { new: true, upsert: true }
  ).lean();
};

export const fetchGeneralSettings = async () => {
  const [general, superAdmin] = await Promise.all([
    GeneralSetting.findOne().lean(),
    SuperAdmin.findOne().lean()
  ]);

  return {
    companyName: superAdmin?.organizationName || general?.companyName || 'Meeraco Power Systems Pvt Ltd',
    registeredAddress: superAdmin?.registeredAddress || general?.registeredAddress || 'Plot 42, Okhla Industrial Area Phase 2',
    gstin: superAdmin?.gstin || general?.gstin || '07AABCM1234C1Z5',
    logo: superAdmin?.logoUrl || general?.logoUrl || '/logo-full.png',
    logoUrl: superAdmin?.logoUrl || general?.logoUrl || '/logo-full.png'
  };
};

export const saveGeneralSettings = async (data) => {
  const superAdminUpdate = {};
  if (data.companyName) superAdminUpdate.organizationName = data.companyName;
  if (data.registeredAddress) superAdminUpdate.registeredAddress = data.registeredAddress;
  if (data.gstin) superAdminUpdate.gstin = data.gstin;
  if (data.logoUrl || data.logo) superAdminUpdate.logoUrl = data.logoUrl || data.logo;

  const [updatedSuperAdmin] = await Promise.all([
    SuperAdmin.findOneAndUpdate({}, { $set: superAdminUpdate }, { new: true, upsert: true }).lean(),
    GeneralSetting.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean()
  ]);

  return {
    companyName: updatedSuperAdmin.organizationName,
    registeredAddress: updatedSuperAdmin.registeredAddress,
    gstin: updatedSuperAdmin.gstin,
    logo: updatedSuperAdmin.logoUrl,
    logoUrl: updatedSuperAdmin.logoUrl
  };
};

// ==========================================
// LEAD CONFIG / LEAD MASTERS (DYNAMIC)
// ==========================================

const normalizeMasterType = (t) => {
  if (!t) return null;
  const s = String(t).toLowerCase();
  if (s === 'stage' || s === 'stages') return 'stages';
  if (s === 'source' || s === 'sources') return 'sources';
  if (s === 'priority' || s === 'priorities') return 'priorities';
  if (s === 'lossreason' || s === 'lossreasons' || s === 'loss_reason' || s === 'loss_reasons') return 'lossReasons';
  return s;
};

const DEFAULT_MASTERS = [
  // Stages
  { type: 'stages', name: 'New', color: 'blue', order: 0, isSystem: false },
  { type: 'stages', name: 'Contacted', color: 'amber', order: 1, isSystem: false },
  { type: 'stages', name: 'Qualified', color: 'purple', order: 2, isSystem: false },
  { type: 'stages', name: 'Negotiation', color: 'orange', order: 3, isSystem: false },
  { type: 'stages', name: 'Won', color: 'emerald', order: 4, isSystem: true },
  { type: 'stages', name: 'Lost', color: 'rose', order: 5, isSystem: true },
  // Sources
  { type: 'sources', name: 'Website', color: 'blue', order: 0, isSystem: false },
  { type: 'sources', name: 'Phone', color: 'emerald', order: 1, isSystem: false },
  { type: 'sources', name: 'Referral', color: 'purple', order: 2, isSystem: false },
  { type: 'sources', name: 'Meta', color: 'cyan', order: 3, isSystem: false },
  { type: 'sources', name: 'Excel import', color: 'grey', order: 4, isSystem: false },
  // Priorities
  { type: 'priorities', name: 'Hot', color: 'rose', order: 0, isSystem: false },
  { type: 'priorities', name: 'Warm', color: 'amber', order: 1, isSystem: false },
  { type: 'priorities', name: 'Cold', color: 'blue', order: 2, isSystem: false },
  // Loss Reasons
  { type: 'lossReasons', name: 'Price', color: 'rose', order: 0, isSystem: false },
  { type: 'lossReasons', name: 'Competitor', color: 'amber', order: 1, isSystem: false },
  { type: 'lossReasons', name: 'No budget', color: 'grey', order: 2, isSystem: false },
  { type: 'lossReasons', name: 'No response', color: 'blue', order: 3, isSystem: false }
];

export const seedDefaultLeadMastersIfEmpty = async () => {
  const count = await LeadMaster.countDocuments();
  if (count === 0) {
    try {
      await LeadMaster.insertMany(DEFAULT_MASTERS);
    } catch (err) {
      console.warn('Default lead masters seed note:', err.message);
    }
  }
};

export const fetchLeadMasters = async (rawType) => {
  await seedDefaultLeadMastersIfEmpty();
  const type = normalizeMasterType(rawType);

  if (type) {
    const list = await LeadMaster.find({ type: { $in: [type, type.slice(0, -1)] } })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    return list.map(item => ({
      id: item._id.toString(),
      _id: item._id.toString(),
      name: item.name,
      color: item.color || 'grey',
      order: item.order ?? 0,
      active: item.active !== false,
      isSystem: Boolean(item.isSystem)
    }));
  }

  // If no type specified, return all grouped by category
  const all = await LeadMaster.find()
    .sort({ order: 1, createdAt: 1 })
    .lean();

  const grouped = {
    stages: [],
    sources: [],
    priorities: [],
    lossReasons: []
  };

  all.forEach(item => {
    const t = normalizeMasterType(item.type);
    if (grouped[t]) {
      grouped[t].push({
        id: item._id.toString(),
        _id: item._id.toString(),
        name: item.name,
        color: item.color || 'grey',
        order: item.order ?? 0,
        active: item.active !== false,
        isSystem: Boolean(item.isSystem)
      });
    }
  });

  return grouped;
};

export const createLeadMaster = async ({ type: rawType, name, color }) => {
  if (!name || !name.trim()) {
    const error = new Error('Name is required');
    error.statusCode = 400;
    throw error;
  }
  const type = normalizeMasterType(rawType);
  if (!type) {
    const error = new Error('Valid master type is required');
    error.statusCode = 400;
    throw error;
  }

  const cleanName = name.trim();
  const existing = await LeadMaster.findOne({
    type: { $in: [type, type.slice(0, -1)] },
    name: new RegExp(`^${cleanName}$`, 'i')
  });

  if (existing) {
    const error = new Error(`'${cleanName}' already exists in this master list`);
    error.statusCode = 409;
    throw error;
  }

  const maxOrderDoc = await LeadMaster.findOne({ type: { $in: [type, type.slice(0, -1)] } }).sort({ order: -1 });
  const nextOrder = (maxOrderDoc?.order ?? -1) + 1;

  const doc = await LeadMaster.create({
    type,
    name: cleanName,
    color: color || 'grey',
    order: nextOrder,
    active: true,
    isSystem: false
  });

  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    name: doc.name,
    color: doc.color,
    order: doc.order,
    active: doc.active,
    isSystem: doc.isSystem
  };
};

export const updateLeadMaster = async (id, data) => {
  const master = await LeadMaster.findById(id);
  if (!master) {
    const error = new Error('Master item not found');
    error.statusCode = 404;
    throw error;
  }

  const updates = {};
  if (data.name && data.name.trim()) updates.name = data.name.trim();
  if (data.color) updates.color = data.color;
  if (typeof data.active !== 'undefined') updates.active = Boolean(data.active);
  if (typeof data.order !== 'undefined') updates.order = Number(data.order);

  const updated = await LeadMaster.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

  return {
    id: updated._id.toString(),
    _id: updated._id.toString(),
    name: updated.name,
    color: updated.color,
    order: updated.order,
    active: updated.active,
    isSystem: Boolean(updated.isSystem)
  };
};

export const reorderLeadMasters = async ({ type: rawType, ids }) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    const error = new Error('Array of IDs is required');
    error.statusCode = 400;
    throw error;
  }
  const type = normalizeMasterType(rawType);

  const ops = ids.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index } }
    }
  }));

  await LeadMaster.bulkWrite(ops);
  return await fetchLeadMasters(type);
};

export const removeLeadMaster = async (id) => {
  const master = await LeadMaster.findById(id);
  if (!master) {
    const error = new Error('Master item not found');
    error.statusCode = 404;
    throw error;
  }

  if (master.isSystem) {
    const error = new Error(`System values like '${master.name}' cannot be deleted. You can deactivate them instead.`);
    error.statusCode = 403;
    throw error;
  }

  await LeadMaster.findByIdAndDelete(id);
  return { id: id.toString(), name: master.name };
};

// ==========================================
// ASSIGNMENT RULES (DYNAMIC)
// ==========================================

export const fetchAssignmentRules = async () => {
  const rules = await AssignmentRule.find()
    .sort({ order: 1, createdAt: 1 })
    .populate('branchId', 'name code')
    .populate('userId', 'name email roleId')
    .populate('group', 'name email roleId')
    .lean();

  return rules.map((r, idx) => ({
    id: r._id.toString(),
    _id: r._id.toString(),
    name: r.name,
    branchId: r.branchId?._id?.toString() || r.branchId || null,
    branchName: r.branchId?.name || null,
    branch: r.branchId,
    state: r.state || '',
    district: r.district || '',
    source: r.source || '',
    assignType: r.assignType || 'group',
    userId: r.userId?._id?.toString() || r.userId || '',
    userName: r.userId?.name || '',
    user: r.userId,
    group: (r.group || []).map(u => u._id?.toString() || u.toString()),
    groupUsers: r.group || [],
    order: r.order ?? idx,
    active: r.active !== false
  }));
};

export const createAssignmentRule = async (data) => {
  if (!data.name || !data.name.trim()) {
    const error = new Error('Rule name is required');
    error.statusCode = 400;
    throw error;
  }

  const maxOrderDoc = await AssignmentRule.findOne().sort({ order: -1 });
  const nextOrder = (maxOrderDoc?.order ?? -1) + 1;

  const rule = await AssignmentRule.create({
    name: data.name.trim(),
    branchId: mongoose.isValidObjectId(data.branchId) ? data.branchId : null,
    state: data.state || null,
    district: data.district || null,
    source: data.source || null,
    assignType: data.assignType === 'user' ? 'user' : 'group',
    userId: mongoose.isValidObjectId(data.userId) ? data.userId : null,
    group: Array.isArray(data.group) ? data.group.filter(id => mongoose.isValidObjectId(id)) : [],
    order: nextOrder,
    active: data.active !== false
  });

  return await AssignmentRule.findById(rule._id)
    .populate('branchId', 'name code')
    .populate('userId', 'name email')
    .populate('group', 'name email')
    .lean();
};

export const updateAssignmentRule = async (id, data) => {
  const rule = await AssignmentRule.findById(id);
  if (!rule) {
    const error = new Error('Assignment rule not found');
    error.statusCode = 404;
    throw error;
  }

  const updates = {};
  if (data.name && data.name.trim()) updates.name = data.name.trim();
  if (typeof data.branchId !== 'undefined') {
    updates.branchId = mongoose.isValidObjectId(data.branchId) ? data.branchId : null;
  }
  if (typeof data.state !== 'undefined') updates.state = data.state || null;
  if (typeof data.district !== 'undefined') updates.district = data.district || null;
  if (typeof data.source !== 'undefined') updates.source = data.source || null;
  if (data.assignType) updates.assignType = data.assignType;
  if (typeof data.userId !== 'undefined') {
    updates.userId = mongoose.isValidObjectId(data.userId) ? data.userId : null;
  }
  if (Array.isArray(data.group)) {
    updates.group = data.group.filter(gId => mongoose.isValidObjectId(gId));
  }
  if (typeof data.active !== 'undefined') updates.active = Boolean(data.active);
  if (typeof data.order !== 'undefined') updates.order = Number(data.order);

  const updated = await AssignmentRule.findByIdAndUpdate(id, { $set: updates }, { new: true })
    .populate('branchId', 'name code')
    .populate('userId', 'name email')
    .populate('group', 'name email')
    .lean();

  return {
    id: updated._id.toString(),
    _id: updated._id.toString(),
    name: updated.name,
    branchId: updated.branchId?._id?.toString() || updated.branchId || null,
    branchName: updated.branchId?.name || null,
    state: updated.state || '',
    district: updated.district || '',
    source: updated.source || '',
    assignType: updated.assignType || 'group',
    userId: updated.userId?._id?.toString() || updated.userId || '',
    userName: updated.userId?.name || '',
    group: (updated.group || []).map(u => u._id?.toString() || u.toString()),
    order: updated.order,
    active: updated.active
  };
};

export const changeAssignmentRuleStatus = async (id, active) => {
  const updated = await AssignmentRule.findByIdAndUpdate(
    id,
    { $set: { active: Boolean(active) } },
    { new: true }
  ).lean();

  if (!updated) {
    const error = new Error('Assignment rule not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: updated._id.toString(),
    _id: updated._id.toString(),
    name: updated.name,
    active: updated.active
  };
};

export const reorderAssignmentRules = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    const error = new Error('Array of rule IDs is required');
    error.statusCode = 400;
    throw error;
  }

  const ops = ids.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index } }
    }
  }));

  await AssignmentRule.bulkWrite(ops);
  return await fetchAssignmentRules();
};

export const removeAssignmentRule = async (id) => {
  const rule = await AssignmentRule.findById(id);
  if (!rule) {
    const error = new Error('Assignment rule not found');
    error.statusCode = 404;
    throw error;
  }

  await AssignmentRule.findByIdAndDelete(id);
  return { id: id.toString(), name: rule.name };
};

export const fetchAuditLogs = async ({ page = 1, limit = 50 }) => {
  return {
    logs: [],
    total: 0,
    pageNum: Number(page) || 1,
    limitNum: Number(limit) || 50
  };
};
