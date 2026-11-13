import mongoose from 'mongoose';
import { Customer, Branch, User, SuperAdmin } from '../../models/index.js';

/**
 * Helper to resolve branchId string/code to valid MongoDB ObjectId
 */
const resolveBranchObjectId = async (branchId) => {
  if (!branchId || branchId === 'all') return null;
  if (mongoose.isValidObjectId(branchId)) return branchId;

  // If code like B1 -> DEL, B2 -> MUM, B3 -> BLR
  const bCode = branchId === 'B1' ? 'DEL' : branchId === 'B2' ? 'MUM' : branchId === 'B3' ? 'BLR' : String(branchId).toUpperCase();
  const branch = await Branch.findOne({ $or: [{ code: bCode }, { name: new RegExp(branchId, 'i') }] });
  return branch ? branch._id : null;
};

/**
 * Helper to resolve ownerId string/id to valid MongoDB ObjectId
 */
const resolveUserObjectId = async (ownerId) => {
  if (!ownerId) return null;
  if (mongoose.isValidObjectId(ownerId)) return ownerId;

  if (ownerId === 'U0' || ownerId === 'super_admin') {
    const sa = await SuperAdmin.findOne();
    return sa ? sa._id : null;
  }
  const user = await User.findOne({ $or: [{ email: ownerId }, { name: new RegExp(ownerId, 'i') }] });
  return user ? user._id : null;
};

/**
 * Format Customer doc for frontend compatibility
 */
const formatCustomer = (c) => {
  const compName = c.companyName || c.name || '';
  return {
    id: c._id.toString(),
    _id: c._id.toString(),
    customerNumber: c.customerNumber,
    name: compName,
    companyName: compName,
    type: c.type || 'Business',
    industry: c.industry || c.segment || '',
    segment: c.segment || c.industry || 'Industrial',
    gstin: c.gstin || '',
    pan: c.pan || '',
    billingAddress: c.billingAddress || '',
    siteAddresses: c.siteAddresses || [],
    city: c.city || '',
    district: c.district || '',
    state: c.state || '',
    pincode: c.pincode || '',
    branchId: c.branchId?._id?.toString() || (c.branchId ? c.branchId.toString() : null),
    branchName: c.branchId?.name || '—',
    branchCode: c.branchId?.code || '',
    ownerId: c.ownerId?._id?.toString() || (c.ownerId ? c.ownerId.toString() : null),
    ownerName: c.ownerId?.name || '—',
    active: c.active !== false,
    contacts: (c.contacts || []).map(ct => ({
      id: ct._id ? ct._id.toString() : (ct.id || 'c-1'),
      name: ct.name || '',
      designation: ct.designation || '',
      mobile: ct.mobile || ct.phone || '',
      email: ct.email || '',
      primary: Boolean(ct.primary)
    })),
    products: (c.products || []).map(p => ({
      id: p._id ? p._id.toString() : (p.id || `p-${Date.now()}`),
      name: p.name || '',
      kva: p.kva || '',
      model: p.model || '',
      serialNumber: p.serialNumber || '',
      qty: p.qty || 1,
      rate: p.rate || 0,
      purchaseDate: p.purchaseDate || null,
      warrantyExpiry: p.warrantyExpiry || null,
      status: p.status || 'Delivered',
      quoteNumber: p.quoteNumber || '',
      notes: p.notes || ''
    })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
};

export const fetchCustomers = async ({ branchId, status, search, page = 1, limit = 10, user }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  // Branch filter
  if (branchId && branchId !== 'all') {
    const resolvedBranch = await resolveBranchObjectId(branchId);
    if (resolvedBranch) {
      query.branchId = resolvedBranch;
    }
  }

  // Role Scope Check
  if (user) {
    const roleStr = String(
      (typeof user.role === 'string' ? user.role : user.role?.name || user.role?.code) ||
      user.roleName ||
      user.roleId?.name ||
      (typeof user.roleId === 'string' ? user.roleId : '') ||
      ''
    ).toLowerCase();

    const currentUserId = user._id || user.id;
    const userBranchId = user.branchId?._id || (mongoose.Types.ObjectId.isValid(user.branchId) ? user.branchId : null);

    const userRole = user.roleId || {};
    const perms = Array.isArray(userRole.permissionsList)
      ? userRole.permissionsList
      : (userRole.simplifiedPermissions && typeof userRole.simplifiedPermissions === 'object')
        ? Object.keys(userRole.simplifiedPermissions).filter(k => userRole.simplifiedPermissions[k])
        : null;

    if (perms && !roleStr.includes('admin')) {
      const canViewAll = perms.includes('view_all_leads');
      const canViewAssigned = perms.includes('view_assigned_leads');

      if (!canViewAll && canViewAssigned) {
        query.ownerId = currentUserId;
      } else if (canViewAll) {
        if (userBranchId) {
          query.$or = [{ branchId: userBranchId }, { ownerId: currentUserId }];
        }
      } else {
        query._id = new mongoose.Types.ObjectId();
      }
    } else if (roleStr.includes('executive')) {
      query.ownerId = currentUserId;
    } else if (roleStr.includes('manager')) {
      if (userBranchId) {
        query.$or = [
          { branchId: userBranchId },
          { ownerId: currentUserId }
        ];
      } else {
        query.ownerId = currentUserId;
      }
    }
  }

  // Active / Status filter
  if (status && status !== 'all') {
    if (status === 'Active' || status === 'true' || status === true) {
      query.active = true;
    } else if (status === 'Inactive' || status === 'false' || status === false) {
      query.active = false;
    }
  }

  // Search filter
  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { companyName: { $regex: s, $options: 'i' } },
      { name: { $regex: s, $options: 'i' } },
      { customerNumber: { $regex: s, $options: 'i' } },
      { gstin: { $regex: s, $options: 'i' } },
      { pan: { $regex: s, $options: 'i' } },
      { city: { $regex: s, $options: 'i' } },
      { 'contacts.name': { $regex: s, $options: 'i' } },
      { 'contacts.mobile': { $regex: s, $options: 'i' } }
    ];
  }

  const [total, rawCustomers] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query)
      .populate('branchId', 'name code')
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
  ]);

  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    customers: rawCustomers.map(formatCustomer),
    total,
    page: pageNum,
    totalPages,
    limit: limitNum
  };
};

export const fetchCustomerById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    // If fallback customer ID like C1, try finding by customerNumber
    const byNum = await Customer.findOne({ customerNumber: id })
      .populate('branchId', 'name code')
      .populate('ownerId', 'name email')
      .lean();
    if (byNum) return formatCustomer(byNum);

    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const customer = await Customer.findById(id)
    .populate('branchId', 'name code')
    .populate('ownerId', 'name email')
    .lean();

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  return formatCustomer(customer);
};

export const createNewCustomer = async (data, user) => {
  const count = await Customer.countDocuments();
  const customerNumber = `CUST-${String(count + 1).padStart(4, '0')}`;

  const compName = (data.companyName || data.name || '').trim();
  const resolvedBranch = await resolveBranchObjectId(data.branchId);
  const resolvedOwner = await resolveUserObjectId(data.ownerId || user?.id);

  // Normalize siteAddresses
  let sites = Array.isArray(data.siteAddresses) ? data.siteAddresses : [];
  if (data.siteText && typeof data.siteText === 'string') {
    sites = data.siteText.split('\n').map(s => s.trim()).filter(Boolean);
  }

  // Normalize contacts
  let contactsList = Array.isArray(data.contacts) ? data.contacts : [];
  if (!contactsList.length && (data.primaryContactName || data.primaryContactPhone)) {
    contactsList.push({
      name: data.primaryContactName || '',
      mobile: data.primaryContactPhone || '',
      email: data.primaryContactEmail || '',
      primary: true
    });
  }

  const newDoc = await Customer.create({
    customerNumber,
    name: compName,
    companyName: compName,
    type: data.type || data.customerType || 'Business',
    industry: data.industry || data.segment || '',
    segment: data.segment || data.industry || 'Industrial',
    gstin: (data.gstin || '').toUpperCase().trim(),
    pan: (data.pan || '').toUpperCase().trim(),
    billingAddress: data.billingAddress || '',
    siteAddresses: sites,
    city: data.city || '',
    district: data.district || '',
    state: data.state || '',
    pincode: data.pincode || '',
    branchId: resolvedBranch,
    ownerId: resolvedOwner,
    active: data.active !== false,
    contacts: contactsList
  });

  const populated = await Customer.findById(newDoc._id)
    .populate('branchId', 'name code')
    .populate('ownerId', 'name email')
    .lean();

  return formatCustomer(populated);
};

export const updateExistingCustomer = async (id, data, user) => {
  const existing = await Customer.findById(id);
  if (!existing) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  const updateFields = {};
  if (data.name || data.companyName) {
    const cName = (data.companyName || data.name).trim();
    updateFields.name = cName;
    updateFields.companyName = cName;
  }
  if (data.type || data.customerType) updateFields.type = data.type || data.customerType;
  if (typeof data.industry !== 'undefined') updateFields.industry = data.industry;
  if (typeof data.segment !== 'undefined') updateFields.segment = data.segment;
  if (typeof data.gstin !== 'undefined') updateFields.gstin = (data.gstin || '').toUpperCase().trim();
  if (typeof data.pan !== 'undefined') updateFields.pan = (data.pan || '').toUpperCase().trim();
  if (typeof data.billingAddress !== 'undefined') updateFields.billingAddress = data.billingAddress;
  if (typeof data.city !== 'undefined') updateFields.city = data.city;
  if (typeof data.district !== 'undefined') updateFields.district = data.district;
  if (typeof data.state !== 'undefined') updateFields.state = data.state;
  if (typeof data.pincode !== 'undefined') updateFields.pincode = data.pincode;
  if (typeof data.active !== 'undefined') updateFields.active = Boolean(data.active);

  if (data.siteText && typeof data.siteText === 'string') {
    updateFields.siteAddresses = data.siteText.split('\n').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(data.siteAddresses)) {
    updateFields.siteAddresses = data.siteAddresses;
  }

  if (Array.isArray(data.contacts)) {
    updateFields.contacts = data.contacts;
  }

  if (Array.isArray(data.products)) {
    updateFields.products = data.products;
  }

  if (typeof data.branchId !== 'undefined') {
    updateFields.branchId = await resolveBranchObjectId(data.branchId);
  }
  if (typeof data.ownerId !== 'undefined') {
    updateFields.ownerId = await resolveUserObjectId(data.ownerId);
  }

  const updated = await Customer.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true }
  )
    .populate('branchId', 'name code')
    .populate('ownerId', 'name email')
    .lean();

  return formatCustomer(updated);
};

export const deleteExistingCustomer = async (id, user) => {
  const existing = await Customer.findById(id);
  if (!existing) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  await Customer.findByIdAndDelete(id);
  return { id, name: existing.companyName || existing.name, success: true };
};

export const createContact = async (customerId, contactData) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  const newContact = {
    name: contactData.name,
    mobile: contactData.mobile || contactData.phone || '',
    email: contactData.email || '',
    designation: contactData.designation || '',
    primary: Boolean(contactData.primary || contactData.isPrimary)
  };

  customer.contacts.push(newContact);
  await customer.save();

  return formatCustomer(customer);
};
