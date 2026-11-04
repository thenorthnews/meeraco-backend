export const ROLE_ID = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'sales_manager',
  EXECUTIVE: 'sales_executive'
});

export const SCOPE = Object.freeze({
  ALL: 'all',
  DISTRICTS: 'districts',
  OWN: 'own'
});

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

export const MODULES = [
  'dashboard', 'leads', 'reassign', 'customers', 'follow_ups', 'quotations', 'reports',
  'users', 'roles', 'branches', 'lead_setup', 'assignment', 'import', 'catalogue',
  'quotation_settings', 'reminder_settings', 'report_access', 'integration', 'audit',
  'mobile_access', 'general_settings'
];

export const PermissionKey = Object.freeze({
  LEADS_CREATE: 'leads.create',
  MANAGE_LEADS: 'leads.edit',
  DEACTIVATE_LEADS: 'leads.delete',
  EXPORT_LEADS: 'leads.export',
  ASSIGN_LEADS: 'reassign.edit',
  MANAGE_CUSTOMERS: 'customers.edit',
  CREATE_CUSTOMERS: 'customers.create',
  EXPORT_CUSTOMERS: 'customers.export',
  MANAGE_QUOTATIONS: 'quotations.edit',
  CREATE_QUOTATIONS: 'quotations.create',
  EXPORT_QUOTATIONS: 'quotations.export',
  VIEW_REPORTS: 'reports.view',
  EXPORT_REPORTS: 'reports.export',
  VIEW_USERS: 'users.view',
  MANAGE_USERS: 'users.edit',
  VIEW_ROLES: 'roles.view',
  MANAGE_ROLES: 'roles.edit',
  VIEW_BRANCHES: 'branches.view',
  MANAGE_BRANCHES: 'branches.edit',
  VIEW_LEAD_SETUP: 'lead_setup.view',
  MANAGE_LEAD_SETUP: 'lead_setup.edit',
  VIEW_ASSIGNMENT: 'assignment.view',
  MANAGE_ASSIGNMENT: 'assignment.edit',
  IMPORT_LEADS: 'import.create',
  VIEW_CATALOGUE: 'catalogue.view',
  MANAGE_CATALOGUE: 'catalogue.edit',
  VIEW_QUOTE_SETTINGS: 'quotation_settings.view',
  MANAGE_QUOTE_SETTINGS: 'quotation_settings.edit',
  VIEW_REMINDERS: 'reminder_settings.view',
  MANAGE_REMINDERS: 'reminder_settings.edit',
  VIEW_REPORT_ACCESS: 'report_access.view',
  MANAGE_REPORT_ACCESS: 'report_access.edit',
  VIEW_INTEGRATION: 'integration.view',
  MANAGE_INTEGRATION: 'integration.edit',
  VIEW_AUDIT: 'audit.view',
  VIEW_MOBILE: 'mobile_access.view',
  MANAGE_MOBILE: 'mobile_access.edit',
  VIEW_GENERAL: 'general_settings.view',
  MANAGE_GENERAL: 'general_settings.edit'
});

