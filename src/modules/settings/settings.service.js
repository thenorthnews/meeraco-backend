import { SuperAdmin, GeneralSetting } from '../../models/index.js';

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
    logoUrl: superAdmin?.logoUrl || general?.logoUrl || '/logo-full.png',
    financialYearStart: superAdmin?.financialYearStart || general?.financialYearStart || 'April',
    dateFormat: superAdmin?.dateFormat || general?.dateFormat || 'DD/MM/YYYY',
    currency: superAdmin?.currency || general?.currency || 'INR (₹)',
    smtpHost: superAdmin?.smtpHost || general?.smtpHost || '',
    smtpPort: superAdmin?.smtpPort || general?.smtpPort || 587,
    smtpUser: superAdmin?.smtpUser || general?.smtpUser || '',
    smtpFrom: superAdmin?.senderEmail || general?.smtpFrom || ''
  };
};

export const saveGeneralSettings = async (data) => {
  const superAdminUpdate = {};
  if (data.companyName) superAdminUpdate.organizationName = data.companyName;
  if (data.registeredAddress) superAdminUpdate.registeredAddress = data.registeredAddress;
  if (data.gstin) superAdminUpdate.gstin = data.gstin;
  if (data.logoUrl || data.logo) superAdminUpdate.logoUrl = data.logoUrl || data.logo;
  if (data.financialYearStart) superAdminUpdate.financialYearStart = data.financialYearStart;
  if (data.dateFormat) superAdminUpdate.dateFormat = data.dateFormat;
  if (data.currency) superAdminUpdate.currency = data.currency;
  if (typeof data.smtpHost !== 'undefined') superAdminUpdate.smtpHost = data.smtpHost;
  if (typeof data.smtpPort !== 'undefined') superAdminUpdate.smtpPort = Number(data.smtpPort) || 587;
  if (typeof data.smtpUser !== 'undefined') superAdminUpdate.smtpUser = data.smtpUser;
  if (typeof data.smtpFrom !== 'undefined') superAdminUpdate.senderEmail = data.smtpFrom;

  const [updatedSuperAdmin, updatedGeneral] = await Promise.all([
    SuperAdmin.findOneAndUpdate({}, { $set: superAdminUpdate }, { new: true, upsert: true }).lean(),
    GeneralSetting.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean()
  ]);

  return {
    companyName: updatedSuperAdmin.organizationName,
    registeredAddress: updatedSuperAdmin.registeredAddress,
    gstin: updatedSuperAdmin.gstin,
    logo: updatedSuperAdmin.logoUrl,
    logoUrl: updatedSuperAdmin.logoUrl,
    financialYearStart: updatedSuperAdmin.financialYearStart,
    dateFormat: updatedSuperAdmin.dateFormat,
    currency: updatedSuperAdmin.currency,
    smtpHost: updatedSuperAdmin.smtpHost,
    smtpPort: updatedSuperAdmin.smtpPort,
    smtpUser: updatedSuperAdmin.smtpUser,
    smtpFrom: updatedSuperAdmin.senderEmail
  };
};

export const fetchLeadMasters = async (type) => {
  return [
    { type: 'segment', value: 'Industrial' },
    { type: 'segment', value: 'Commercial' },
    { type: 'segment', value: 'Residential' },
    { type: 'source', value: 'Direct' },
    { type: 'source', value: 'Website' },
    { type: 'source', value: 'Referral' }
  ];
};

export const fetchAssignmentRules = async () => {
  return [];
};

export const fetchAuditLogs = async ({ page = 1, limit = 50 }) => {
  return {
    logs: [],
    total: 0,
    pageNum: Number(page) || 1,
    limitNum: Number(limit) || 50
  };
};
