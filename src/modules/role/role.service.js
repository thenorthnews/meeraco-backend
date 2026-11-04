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
        usersCount,
        matrix
      };
    })
  );

  // Always prepend Super Admin system role with unchangeable full permissions
  const hasSuperAdmin = results.some(r => r.name === 'Super Admin' || r.id === 'super_admin');
  if (!hasSuperAdmin) {
    const superAdminRole = {
      id: 'super_admin',
      name: 'Super Admin',
      description: 'Full system owner access. Unrestricted across all modules and actions.',
      scope: 'all',
      isSystem: true,
      usersCount: 1,
      matrix: Object.fromEntries(MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true, export: true }]))
    };
    results.unshift(superAdminRole);
  }

  return results;
};

export const fetchRoleById = async (id) => {
  const role = await Role.findById(id).lean();
  if (!role) {
    const error = new Error(`Role with ID '${id}' not found`);
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
    isSystem: false
  });

  // Initialize 14 module permissions (using passed matrix if provided)
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
  const role = await Role.findById(id);
  if (!role) {
    const error = new Error('Role not found');
    error.statusCode = 404;
    throw error;
  }

  if (role.isSystem && data.scope && data.scope !== role.scope) {
    const error = new Error('System roles cannot have their scope modified');
    error.statusCode = 400;
    throw error;
  }

  const updated = await Role.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  return updated;
};

export const updateRolePermission = async (roleId, data) => {
  if (roleId === 'super_admin') {
    const error = new Error('The Super Admin role cannot be edited or deleted.');
    error.statusCode = 400;
    throw error;
  }

  const role = await Role.findById(roleId);
  if (!role) {
    const error = new Error('Role not found');
    error.statusCode = 404;
    throw error;
  }

  if (role.isSystem || role.name === 'Super Admin') {
    const error = new Error('The Super Admin role cannot be edited or deleted.');
    error.statusCode = 400;
    throw error;
  }

  // Bulk matrix update
  if (data.matrix && typeof data.matrix === 'object') {
    const promises = MODULES.map(async (m) => {
      const p = data.matrix[m] || {};
      return RolePermission.findOneAndUpdate(
        { roleId, module: m },
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
  const role = await Role.findById(id);
  if (!role) {
    const error = new Error('Role not found');
    error.statusCode = 404;
    throw error;
  }

  if (role.isSystem) {
    const error = new Error('The Super Admin role cannot be edited or deleted.');
    error.statusCode = 400;
    throw error;
  }

  const usersCount = await User.countDocuments({ roleId: id });
  if (usersCount > 0) {
    const error = new Error(`Cannot delete role: ${usersCount} user(s) are currently assigned to it`);
    error.statusCode = 400;
    throw error;
  }

  await Role.findByIdAndDelete(id);
  await RolePermission.deleteMany({ roleId: id });

  return { message: 'Role deleted successfully' };
};
