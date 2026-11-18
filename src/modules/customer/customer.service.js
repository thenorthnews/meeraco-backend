import mongoose from 'mongoose';
import { Customer, Branch, User, SuperAdmin, Quotation, Lead } from '../../models/index.js';
import { emitCustomerCreated, emitCustomerUpdated, emitCustomerDeleted } from '../../socket/socket.js';

/**
 * Enrich customer products with products from accepted/approved/sent quotations
 */
const enrichCustomerProducts = async (customerDoc) => {
  if (!customerDoc) return customerDoc;
  try {
    const custId = customerDoc._id;
    const custNum = customerDoc.customerNumber;
    const compName = (customerDoc.companyName || customerDoc.name || '').trim();

    // Find all leads associated with this customer
    const leads = await Lead.find({
      $or: [
        { customerId: custId },
        ...(compName ? [{ company: new RegExp(`^${compName}$`, 'i') }] : [])
      ]
    }).select('_id name company').lean();

    const leadIds = leads.map(l => l._id);

    // Find all quotations for this customer or associated leads
    const quotes = await Quotation.find({
      $or: [
        { customerId: custId },
        { customerNumber: custNum },
        ...(leadIds.length > 0 ? [{ leadId: { $in: leadIds } }] : [])
      ],
      $or: [
        { status: { $in: ['Accepted', 'Won', 'Sent', 'Approved'] } },
        { approvalStatus: 'Approved' }
      ]
    }).lean();

    const directProducts = Array.isArray(customerDoc.products) ? [...customerDoc.products] : [];
    const directKeys = new Set(directProducts.map(p => `${p.quoteNumber || ''}_${p.name}`));

    quotes.forEach(q => {
      const items = Array.isArray(q.items) ? q.items : Array.isArray(q.lines) ? q.lines : [];
      items.forEach((it, idx) => {
        const desc = it.description || it.name || 'Genset Equipment';
        const key = `${q.quoteNumber || ''}_${desc}`;
        if (!directKeys.has(key)) {
          directKeys.add(key);
          const kvaMatch = desc.match(/(\d+(\.\d+)?\s*kVA)/i);
          directProducts.push({
            id: `q-${q._id}-${idx}`,
            _id: `q-${q._id}-${idx}`,
            name: desc,
            kva: it.kva || (kvaMatch ? kvaMatch[1] : ''),
            model: it.model || desc,
            serialNumber: it.serialNumber || '—',
            qty: it.quantity || it.qty || 1,
            rate: it.total || it.unitPrice || it.rate || 0,
            purchaseDate: q.approvedAt || q.updatedAt || q.createdAt,
            warrantyExpiry: null,
            status: (q.status === 'Accepted' || q.status === 'Won') ? 'Under Warranty' : 'Quoted',
            quoteNumber: q.quoteNumber || '—',
            notes: `From Quotation ${q.quoteNumber || ''}`,
            isFromQuote: true
          });
        }
      });
    });

    customerDoc.products = directProducts;
  } catch (err) {
    console.warn('Enrich customer products error:', err.message);
  }
  return customerDoc;
};

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
      notes: p.notes || '',
      isFromQuote: Boolean(p.isFromQuote)
    })),
    leadsCount: c.leadsCount ?? 0,
    wonCount: c.wonCount ?? 0,
    wonValue: c.wonValue ?? 0,
    source: c.source || (c.wonCount > 0 ? 'Won deal' : 'Manual'),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
};

export const fetchCustomers = async ({ branchId, status, search, page = 1, limit = 10, user }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const skip = (pageNum - 1) * limitNum;

  const andClauses = [];

  // Branch filter
  if (branchId && branchId !== 'all') {
    const resolvedBranch = await resolveBranchObjectId(branchId);
    if (resolvedBranch) {
      andClauses.push({ branchId: resolvedBranch });
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

    const isTopAdmin = roleStr.includes('admin') || roleStr.includes('super') || roleStr.includes('owner');
    const isManager = roleStr.includes('manager');

    const currentUserId = user._id || user.id;
    const userObjId = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    const rawBranchId = user.branchId?._id || user.branchId?.id || user.branch?.id || user.branch?._id || user.branchId;
    const userBranchId = (rawBranchId && mongoose.Types.ObjectId.isValid(rawBranchId))
      ? new mongoose.Types.ObjectId(rawBranchId)
      : null;

    if (!isTopAdmin) {
      if (isManager) {
        // Sales Manager: Branch head.
        // Manager should see:
        // 1. All customers with branchId matching manager's branch
        // 2. Customers owned by manager or by team members in manager's branch
        // 3. Customers linked to leads in this branch/team
        // 4. Won deal customers
        const teamMemberIds = [userObjId];
        const teamQuery = {
          $or: [
            { managerId: userObjId },
            ...(userBranchId ? [{ branchId: userBranchId }] : [])
          ]
        };
        const teamUsers = await User.find(teamQuery).select('_id').lean();
        teamUsers.forEach(u => teamMemberIds.push(u._id));

        const branchLeads = await Lead.find({
          $or: [
            ...(userBranchId ? [{ branchId: userBranchId }] : []),
            { assignedToId: { $in: teamMemberIds } },
            { createdById: { $in: teamMemberIds } }
          ],
          customerId: { $ne: null }
        }).select('customerId').lean();

        const branchCustIds = branchLeads.map(l => l.customerId).filter(Boolean);

        const managerScopeOr = [
          { ownerId: { $in: teamMemberIds } },
          ...(userBranchId ? [{ branchId: userBranchId }] : []),
          ...(branchCustIds.length > 0 ? [{ _id: { $in: branchCustIds } }] : []),
          { source: /won/i }
        ];

        andClauses.push({ $or: managerScopeOr });
      } else {
        // Sales Executive: Field executive
        // Executive should see:
        // 1. Customers they own
        // 2. Customers linked to leads assigned to them or created by them
        const myLeads = await Lead.find({
          $or: [
            { assignedToId: userObjId },
            { createdById: userObjId }
          ],
          customerId: { $ne: null }
        }).select('customerId').lean();

        const myCustIds = myLeads.map(l => l.customerId).filter(Boolean);

        andClauses.push({
          $or: [
            { ownerId: userObjId },
            ...(myCustIds.length > 0 ? [{ _id: { $in: myCustIds } }] : [])
          ]
        });
      }
    }
  }

  // Active / Status filter
  if (status && status !== 'all') {
    if (status === 'Active' || status === 'true' || status === true) {
      andClauses.push({ active: true });
    } else if (status === 'Inactive' || status === 'false' || status === false) {
      andClauses.push({ active: false });
    }
  }

  // Search filter
  if (search && search.trim()) {
    const s = search.trim();
    andClauses.push({
      $or: [
        { companyName: { $regex: s, $options: 'i' } },
        { name: { $regex: s, $options: 'i' } },
        { customerNumber: { $regex: s, $options: 'i' } },
        { gstin: { $regex: s, $options: 'i' } },
        { pan: { $regex: s, $options: 'i' } },
        { city: { $regex: s, $options: 'i' } },
        { 'contacts.name': { $regex: s, $options: 'i' } },
        { 'contacts.mobile': { $regex: s, $options: 'i' } }
      ]
    });
  }

  const query = andClauses.length > 0 ? { $and: andClauses } : {};

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

  if (rawCustomers.length > 0) {
    try {
      const custIds = rawCustomers.map(c => c._id);
      const custNumbers = rawCustomers.map(c => c.customerNumber).filter(Boolean);
      const compNames = rawCustomers.map(c => (c.companyName || c.name || '').trim()).filter(Boolean);

      const leads = await Lead.find({
        $or: [
          { customerId: { $in: custIds } },
          { customerId: { $in: custNumbers } },
          { company: { $in: compNames.map(n => new RegExp(`^${n}$`, 'i')) } }
        ]
      }).select('_id customerId company stage estimatedValue value quotationId').lean();

      const leadIds = leads.map(l => l._id);

      const quotes = await Quotation.find({
        $or: [
          { customerId: { $in: custIds } },
          { customerNumber: { $in: custNumbers } },
          ...(leadIds.length > 0 ? [{ leadId: { $in: leadIds } }] : [])
        ]
      }).select('_id customerId customerNumber leadId status grandTotal total').lean();

      rawCustomers.forEach(c => {
        const cIdStr = c._id.toString();
        const cNum = c.customerNumber;
        const cNameLower = (c.companyName || c.name || '').trim().toLowerCase();

        const matchedLeads = leads.filter(l => {
          const lCustId = String(l.customerId || '');
          const lComp = (l.company || '').trim().toLowerCase();
          return lCustId === cIdStr || (cNum && lCustId === cNum) || (cNameLower && lComp === cNameLower);
        });

        const matchedLeadIds = new Set(matchedLeads.map(l => l._id.toString()));

        const matchedQuotes = quotes.filter(q => {
          const qCustId = String(q.customerId || '');
          const qLeadId = String(q.leadId || '');
          return qCustId === cIdStr || (cNum && q.customerNumber === cNum) || (qLeadId && matchedLeadIds.has(qLeadId));
        });

        const wonLeads = matchedLeads.filter(l => l.stage === 'Won' || l.stage === 'Deal Won');
        const wonQuotes = matchedQuotes.filter(q => q.status === 'Accepted' || q.status === 'Won');

        c.leadsCount = matchedLeads.length;
        c.wonCount = Math.max(wonLeads.length, wonQuotes.length);

        const quoteVal = wonQuotes.reduce((acc, q) => acc + (Number(q.grandTotal || q.total) || 0), 0);
        const leadVal = wonLeads.reduce((acc, l) => acc + (Number(l.estimatedValue || l.value) || 0), 0);
        c.wonValue = quoteVal || leadVal || 0;
        c.source = (c.wonCount > 0 || String(c.source || '').toLowerCase().includes('won')) ? 'Won deal' : (c.source || 'Manual');
      });
    } catch (enrichErr) {
      console.warn('Customer enrichment note:', enrichErr.message);
    }
  }

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
    if (byNum) {
      await enrichCustomerProducts(byNum);
      return formatCustomer(byNum);
    }

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

  await enrichCustomerProducts(customer);
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

  const formatted = formatCustomer(populated);
  try {
    emitCustomerCreated(formatted);
  } catch (e) {
    console.warn('Socket emit customer created error:', e.message);
  }
  return formatted;
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

  const formatted = formatCustomer(updated);
  try {
    emitCustomerUpdated(formatted);
  } catch (e) {
    console.warn('Socket emit customer updated error:', e.message);
  }
  return formatted;
};

export const deleteExistingCustomer = async (id, user) => {
  const existing = await Customer.findById(id);
  if (!existing) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  await Customer.findByIdAndDelete(id);
  try {
    emitCustomerDeleted(id);
  } catch (e) {
    console.warn('Socket emit customer deleted error:', e.message);
  }
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
