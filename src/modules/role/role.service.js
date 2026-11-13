import mongoose from 'mongoose';
import { Role, RolePermission, User } from '../../models/index.js';

const MODULES = [
  'dashboard', 'leads', 'reassign', 'customers', 'follow_ups', 'quotations', 'reports',
  'users', 'roles', 'branches', 'lead_setup', 'assignment', 'import', 'catalogue',
  'quotation_settings', 'reminder_settings', 'report_access', 'integration', 'audit', 'mobile_access', 'general_settings'
];

export const fetchAllRoles = async () => {
  let roles = await Role.find().sort({ createdAt: 1 }).lean();

  if (roles.length === 0) {
    const defaultRoles = [
      { name: 'Admin', description: 'System Administrator with branch and team management rights.', scope: 'all', isSystem: false },
      { name: 'Sales Manager', description: 'Branch or territory manager with pipeline access.', scope: 'districts', isSystem: false },
      { name: 'Sales Executive', description: 'Individual sales rep handling assigned leads.', scope: 'own', isSystem: false }
    ];

    for (const dr of defaultRoles) {
      const created = await Role.create(dr);
      const isMgr = dr.name === 'Sales Manager';
      const isExec = dr.name === 'Sales Executive';

      for (const m of MODULES) {
        let v = true, c = true, e = true, d = true, ex = true;
        if (isMgr) {
          const mgrMods = ['dashboard', 'leads', 'reassign', 'customers', 'follow_ups', 'quotations', 'reports', 'import', 'catalogue'];
          v = mgrMods.includes(m);
          c = ['leads', 'customers', 'follow_ups', 'quotations', 'import'].includes(m);
          e = ['leads', 'reassign', 'customers', 'follow_ups', 'quotations'].includes(m);
          d = false;
          ex = ['leads', 'customers', 'quotations', 'reports'].includes(m);
        } else if (isExec) {
          const execMods = ['dashboard', 'leads', 'customers', 'follow_ups', 'quotations', 'catalogue'];
          v = execMods.includes(m);
          c = ['leads', 'customers', 'follow_ups', 'quotations'].includes(m);
          e = ['leads', 'customers', 'follow_ups', 'quotations'].includes(m);
          d = false;
          ex = false;
        }
        await RolePermission.create({
          roleId: created._id,
          module: m,
          canView: v,
          canCreate: c,
          canEdit: e,
          canDelete: d,
          canExport: ex
        });
      }
    }
    roles = await Role.find().sort({ createdAt: 1 }).lean();
  }

  const results = await Promise.all(
    roles.map(async (r) => {
      const perms = await RolePermission.find({ roleId: r._id }).lean();
      const usersCount = await User.countDocuments({ roleId: r._id });

      const matrix = {};
      MODULES.forEach(m => {
        const p = perms.find(perm => perm.module === m);
        matrix[m] = {
          view: !!p?.canView,
          create: !!p?.canCreate,
          edit: !!p?.canEdit,
          delete: !!p?.canDelete,
          export: !!p?.canExport
        };
      });

      return {
        id: r._id.toString(),
        name: r.name,
        description: r.description,
        scope: r.scope,
        isSystem: r.isSystem,
        permissionsList: r.permissionsList || [],
        simplifiedPermissions: r.simplifiedPermissions || {},
        usersCount,
        matrix
      };
    })
  );

  // Ensure Admin is always present
  if (!results.some(r => r.name === 'Admin')) {
    results.unshift({
      id: 'admin',
      name: 'Admin',
      description: 'System Administrator with full access across all modules and branches.',
      scope: 'all',
      isSystem: true,
      usersCount: 1,
      matrix: Object.fromEntries(MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true, export: true }]))
    });
  }

  // Canonical sort: Admin, Sales Manager, Sales Executive, followed by custom roles
  const ORDER = ['Admin', 'Sales Manager', 'Sales Executive'];
  results.sort((a, b) => {
    const idxA = ORDER.indexOf(a.name);
    const idxB = ORDER.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return results.map(r => {
    if (r.name === 'Admin' || r.id === 'admin') {
      return {
        ...r,
        description: 'System Administrator with full access across all modules and branches.',
        scope: 'all',
        isSystem: true,
        matrix: Object.fromEntries(MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true, export: true }]))
      };
    }
    return r;
  });
};

export const fetchRoleById = async (id) => {
  let role = null;
  const idStr = String(id || '').trim();

  if (idStr === 'super_admin' || idStr === 'admin') {
    role = await Role.findOne({ name: 'Admin' }).lean();
  }
  if (!role && mongoose.isValidObjectId(idStr)) {
    role = await Role.findById(idStr).lean();
  }
  if (!role) {
    const cleanName = idStr.replace(/_/g, ' ');
    role = await Role.findOne({
      $or: [
        { name: new RegExp(`^${idStr}$`, 'i') },
        { name: new RegExp(`^${cleanName}$`, 'i') }
      ]
    }).lean();
  }
  if (!role) {
    const error = new Error(`Role with ID '${idStr}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const perms = await RolePermission.find({ roleId: role._id }).lean();
  const matrix = {};
  MODULES.forEach(m => {
    const p = perms.find(perm => perm.module === m);
    matrix[m] = {
      view: !!p?.canView,
      create: !!p?.canCreate,
      edit: !!p?.canEdit,
      delete: !!p?.canDelete,
      export: !!p?.canExport
    };
  });

  return {
    id: role._id.toString(),
    ...role,
    permissionsList: role.permissionsList || [],
    simplifiedPermissions: role.simplifiedPermissions || {},
    matrix
  };
};

export const createRole = async (data) => {
  const existing = await Role.findOne({ name: data.name.trim() });
  if (existing) {
    const error = new Error(`Role '${data.name}' already exists`);
    error.statusCode = 400;
    throw error;
  }

  const role = await Role.create({
    name: data.name.trim(),
    description: data.description || '',
    scope: data.scope || 'own',
    isSystem: false,
    permissionsList: data.permissionsList || [],
    simplifiedPermissions: data.simplifiedPermissions || {}
  });

  // Initialize module permissions (using passed matrix if provided)
  for (const m of MODULES) {
    const mod = data.matrix?.[m] || {};
    await RolePermission.create({
      roleId: role._id,
      module: m,
      canView: !!mod.view,
      canCreate: !!mod.create,
      canEdit: !!mod.edit,
      canDelete: !!mod.delete,
      canExport: !!mod.export
    });
  }

  return await fetchRoleById(role._id);
};

export const updateRole = async (id, data) => {
  let role = null;
  const idStr = String(id || '').trim();
  if (idStr === 'admin' || idStr === 'super_admin') {
    role = await Role.findOne({ name: 'Admin' });
  } else if (mongoose.isValidObjectId(idStr)) {
    role = await Role.findById(idStr);
  } else {
    const cleanName = idStr.replace(/_/g, ' ');
    role = await Role.findOne({
      $or: [
        { name: new RegExp(`^${idStr}$`, 'i') },
        { name: new RegExp(`^${cleanName}$`, 'i') }
      ]
    });
  }

  if (!role) {
    const error = new Error('Role not found');
    error.statusCode = 404;
    throw error;
  }

  const updateFields = {};
  if (data.name && (!role.isSystem || role.name !== 'Admin')) {
    updateFields.name = data.name.trim();
  }
  if (typeof data.description !== 'undefined') {
    updateFields.description = data.description.trim();
  }
  if (data.scope && (!role.isSystem || role.name !== 'Admin')) {
    updateFields.scope = data.scope;
  }
  if (data.permissionsList) {
    updateFields.permissionsList = data.permissionsList;
  }
  if (data.simplifiedPermissions) {
    updateFields.simplifiedPermissions = data.simplifiedPermissions;
  }

  await Role.findByIdAndUpdate(role._id, { $set: updateFields }, { new: true });

  // If matrix is passed, also update RolePermission collection
  if (data.matrix && typeof data.matrix === 'object' && role.name !== 'Admin') {
    for (const m of MODULES) {
      const p = data.matrix[m] || {};
      await RolePermission.findOneAndUpdate(
        { roleId: role._id, module: m },
        {
          $set: {
            canView: !!p.view,
            canCreate: !!p.create,
            canEdit: !!p.edit,
            canDelete: !!p.delete,
            canExport: !!p.export
          }
        },
        { new: true, upsert: true }
      );
    }
  }

  return await fetchRoleById(role._id);
};

export const updateRolePermission = async (roleId, data) => {
  let role = null;
  const idStr = String(roleId || '').trim();
  if (idStr === 'admin' || idStr === 'super_admin') {
    role = await Role.findOne({ name: 'Admin' });
  } else if (mongoose.isValidObjectId(idStr)) {
    role = await Role.findById(idStr);
  } else {
    const cleanName = idStr.replace(/_/g, ' ');
    role = await Role.findOne({
      $or: [
        { name: new RegExp(`^${idStr}$`, 'i') },
        { name: new RegExp(`^${cleanName}$`, 'i') }
      ]
    });
  }

  if (!role) {
    const error = new Error('Role not found');
    error.statusCode = 404;
    throw error;
  }

  if (role.name === 'Admin' || role.id === 'admin') {
    return await fetchRoleById(role._id);
  }

  // Bulk matrix update
  if (data.matrix && typeof data.matrix === 'object') {
    const promises = MODULES.map(async (m) => {
      const p = data.matrix[m] || {};
      return RolePermission.findOneAndUpdate(
        { roleId: role._id, module: m },
        {
          $set: {
            canView: !!p.view,
            canCreate: !!p.create,
            canEdit: !!p.edit,
            canDelete: !!p.delete,
            canExport: !!p.export
          }
        },
        { new: true, upsert: true }
      );
    });
    await Promise.all(promises);
    return await fetchRoleById(roleId);
  }

  // Single action or single module update
  const { module, action, value, canView, canCreate, canEdit, canDelete, canExport } = data;
  const permData = {};
  if (action && typeof value === 'boolean') {
    if (action === 'view') permData.canView = value;
    if (action === 'create') permData.canCreate = value;
    if (action === 'edit') permData.canEdit = value;
    if (action === 'delete') permData.canDelete = value;
    if (action === 'export') permData.canExport = value;
  } else {
    if (typeof canView === 'boolean') permData.canView = canView;
    if (typeof canCreate === 'boolean') permData.canCreate = canCreate;
    if (typeof canEdit === 'boolean') permData.canEdit = canEdit;
    if (typeof canDelete === 'boolean') permData.canDelete = canDelete;
    if (typeof canExport === 'boolean') permData.canExport = canExport;
  }

  const record = await RolePermission.findOneAndUpdate(
    { roleId, module },
    { $set: permData },
    { new: true, upsert: true }
  );

  return record;
};

export const deleteRole = async (id) => {
  let role = null;
  if (mongoose.isValidObjectId(id)) {
    role = await Role.findById(id);
  } else {
    role = await Role.findOne({ name: new RegExp(`^${id}$`, 'i') });
  }

  if (!role) {
    const error = new Error('Role not found');
    error.statusCode = 404;
    throw error;
  }

  if (role.isSystem || role.name === 'Admin' || role.name === 'Sales Manager' || role.name === 'Sales Executive') {
    const error = new Error('Primary system roles cannot be deleted.');
    error.statusCode = 400;
    throw error;
  }

  const usersCount = await User.countDocuments({ roleId: role._id });
  if (usersCount > 0) {
    const error = new Error(`Cannot delete: ${usersCount} user(s) are assigned to this role.`);
    error.statusCode = 400;
    throw error;
  }

  await RolePermission.deleteMany({ roleId: role._id });
  await Role.findByIdAndDelete(role._id);

  return { message: `Role '${role.name}' deleted successfully` };
};
