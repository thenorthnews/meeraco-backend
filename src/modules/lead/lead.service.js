import mongoose from 'mongoose';
import { Lead, User, Branch, Customer, LeadActivity, SuperAdmin } from '../../models/index.js';
import logger from '../../helpers/logger.js';

const toValidObjectId = id => {
  if (!id) return null;
  const str = String(id?._id || id?.id || id).trim();
  return /^[0-9a-fA-F]{24}$/.test(str) ? new mongoose.Types.ObjectId(str) : null;
};

export const recordActivity = async ({ leadId, type, title, description = '', user }) => {
  try {
    const rawId = user?._id || user?.id;
    return await LeadActivity.create({
      leadId,
      type,
      title,
      description,
      performedBy: user?.name || 'System',
      performedById: toValidObjectId(rawId)
    });
  } catch (err) {
    logger.error('Failed to insert LeadActivity record:', err);
  }
};

export const fetchLeadActivities = async (leadId) => {
  return await LeadActivity.find({ leadId })
    .populate('performedById', 'name email mobile')
    .sort({ createdAt: -1 })
    .lean();
};

export const generateLeadNumber = async () => {
  const count = await Lead.countDocuments();
  return `L-${String(count + 1).padStart(4, '0')}`;
};

export const fetchLeads = async ({ stage, source, priority, branchId, date, search, page = 1, limit = 20, user }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  // Stage filter
  if (stage && stage !== 'All') {
    query.stage = new RegExp(`^${stage.trim()}$`, 'i');
  }

  // Source filter
  if (source && source !== 'All sources' && source !== 'All') {
    query.source = new RegExp(`^${source.trim()}$`, 'i');
  }

  // Priority filter
  if (priority && priority !== 'All priorities' && priority !== 'All') {
    query.priority = new RegExp(`^${priority.trim()}$`, 'i');
  }

  // Branch filter
  if (branchId && branchId !== 'All branches') {
    if (mongoose.Types.ObjectId.isValid(branchId)) {
      query.branchId = new mongoose.Types.ObjectId(branchId);
    } else {
      const bMatch = await Branch.findOne({ $or: [{ name: branchId }, { code: branchId }] });
      if (bMatch) query.branchId = bMatch._id;
    }
  }

  // Single Date filter (matches entire day)
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.createdAt = { $gte: start, $lte: end };
  }

  const andClauses = [];

  // Search filter across multiple fields
  if (search && search.trim()) {
    const term = search.trim();
    andClauses.push({
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { company: { $regex: term, $options: 'i' } },
        { leadNumber: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } }
      ]
    });
  }

  // Role Scope & Permissions Check (View Assigned vs View Other Leads)
  if (user) {
    const roleStr = String(
      (typeof user.role === 'string' ? user.role : user.role?.name || user.role?.code) ||
      user.roleName ||
      user.roleId?.name ||
      (typeof user.roleId === 'string' ? user.roleId : '') ||
      ''
    ).toLowerCase();

    const isTopAdmin = roleStr.includes('admin') || roleStr.includes('super');

    if (!isTopAdmin) {
      const currentUserId = user._id || user.id;
      const userBranchId = user.branchId?._id || (mongoose.Types.ObjectId.isValid(user.branchId) ? user.branchId : null);

      const userRole = user.roleId || {};
      const fromList = Array.isArray(userRole.permissionsList) ? userRole.permissionsList : [];
      const fromObj = (userRole.simplifiedPermissions && typeof userRole.simplifiedPermissions === 'object')
        ? Object.keys(userRole.simplifiedPermissions).filter(k => Boolean(userRole.simplifiedPermissions[k]))
        : [];
      const perms = Array.from(new Set([...fromList, ...fromObj]));

      const userObjId = mongoose.Types.ObjectId.isValid(currentUserId)
        ? new mongoose.Types.ObjectId(currentUserId)
        : currentUserId;
      const userStrId = String(currentUserId);

      const hasExplicitConfig = Boolean(
        userRole.simplifiedPermissions && typeof userRole.simplifiedPermissions === 'object' && Object.keys(userRole.simplifiedPermissions).length > 0
      ) || (Array.isArray(userRole.permissionsList) && userRole.permissionsList.length > 0);

      // Determine permissions (respecting dynamic toggles or role defaults)
      const canViewAssigned = hasExplicitConfig
        ? perms.includes('view_assigned_leads')
        : (roleStr.includes('manager') || roleStr.includes('executive'));

      const canViewAll = hasExplicitConfig
        ? perms.includes('view_all_leads')
        : roleStr.includes('manager');

      const isMyLeadFilter = {
        $or: [
          { assignedToId: userObjId },
          { assignedToId: userStrId }
        ]
      };

      const isOtherLeadFilter = {
        $and: [
          { assignedToId: { $ne: userObjId } },
          { assignedToId: { $ne: userStrId } }
        ]
      };

      if (canViewAssigned && canViewAll) {
        // 1. Both enabled: Apna bhi dikhega aur doosron ka bhi dikhega across company and branch
        // No restriction applied: all company and branch leads visible
      } else if (canViewAssigned && !canViewAll) {
        // 2. Sirf View Assigned Leads Only: Sirf apna assigned lead dikhega
        andClauses.push(isMyLeadFilter);
      } else if (!canViewAssigned && canViewAll) {
        // 3. Sirf View All Other Leads: Sirf doosron ke leads dikhenge across company and branch (apna assigned nahi)
        andClauses.push(isOtherLeadFilter);
      } else {
        // 4. Dono disable hain: Koi lead nahi dikhega
        andClauses.push({ _id: new mongoose.Types.ObjectId() });
      }
    }
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  const [total, rawLeads, superAdmins] = await Promise.all([
    Lead.countDocuments(query),
    Lead.find(query)
      .populate('assignedToId', 'name email mobile')
      .populate('assignedById', 'name email mobile')
      .populate('createdById', 'name email mobile')
      .populate('branchId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SuperAdmin.find().select('name email mobile').lean()
  ]);

  const superAdminMap = new Map();
  superAdmins.forEach(sa => {
    const id = sa._id.toString();
    const cleanSaName = sa.name ? sa.name.replace(/sxsxsxdcdc/gi, '').replace(/\(Owner\)/gi, '').trim() || 'Meera Rao' : 'Meera Rao';
    superAdminMap.set(id, cleanSaName);
    superAdminMap.set('super_admin', cleanSaName);
    superAdminMap.set('U0', cleanSaName);
  });
  const defaultOwnerName = superAdmins[0]?.name?.replace(/sxsxsxdcdc/gi, '')?.replace(/\(Owner\)/gi, '')?.trim() || user?.name || 'Meera Rao';

  // Backfill existing leads with null assignedToId to SuperAdmin
  if (superAdmins[0]?._id) {
    Lead.updateMany(
      { $or: [{ assignedToId: null }, { assignedToId: { $exists: false } }] },
      { $set: { assignedToId: superAdmins[0]._id } }
    ).catch(() => {});
  }

  const leads = rawLeads.map(l => {
    const aToId = l.assignedToId?._id ? l.assignedToId._id.toString() : (l.assignedToId ? l.assignedToId.toString() : null);
    const resolvedAssignedTo = l.assignedToId?.name || (aToId ? superAdminMap.get(aToId) : null) || defaultOwnerName;
    const aById = l.assignedById?._id ? l.assignedById._id.toString() : (l.assignedById ? l.assignedById.toString() : null);
    const resolvedAssignedBy = l.assignedById?.name || (aById ? superAdminMap.get(aById) : null) || l.createdById?.name || defaultOwnerName;

    return {
      id: l._id.toString(),
      _id: l._id.toString(),
      leadNumber: l.leadNumber,
      name: l.name || l.contactName || 'Unnamed Contact',
      company: l.company || '—',
      phone: l.phone,
      email: l.email || '',
      stage: l.stage || 'New',
      priority: l.priority || 'Warm',
      source: l.source || 'Direct',
      status: l.status || 'Active',
      active: l.active !== false,
      kva: l.kva,
      quantity: l.quantity || 1,
      value: l.estimatedValue || 0,
      estimatedValue: l.estimatedValue || 0,
      state: l.state || '',
      district: l.district || '',
      city: l.city || '',
      pincode: l.pincode || '',
      siteLocation: l.siteLocation || '',
      assignedToId: aToId,
      assignedTo: resolvedAssignedTo,
      assignedById: aById,
      assignedBy: resolvedAssignedBy,
      branchId: l.branchId?._id ? l.branchId._id.toString() : (l.branchId || null),
      branch: l.branchId?.name || '',
      branchName: l.branchId?.name || '',
      lossReason: l.lossReason || null,
      notes: l.notes || [],
      stageHistory: l.stageHistory || [],
      activity: l.activity || [],
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    };
  });

  return {
    leads,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    page: pageNum,
    limit: limitNum
  };
};

export const fetchLeadById = async (id, user) => {
  const [lead, dbActivities] = await Promise.all([
    Lead.findById(id)
      .populate('assignedToId', 'name email mobile')
      .populate('assignedById', 'name email mobile')
      .populate('createdById', 'name email mobile')
      .populate('branchId', 'name code')
      .lean(),
    LeadActivity.find({ leadId: id })
      .populate('performedById', 'name email mobile')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  const activities = (dbActivities && dbActivities.length > 0)
    ? dbActivities.map(a => ({
        id: a._id.toString(),
        type: a.type,
        title: a.title,
        text: a.description ? `${a.title}: ${a.description}` : a.title,
        description: a.description || '',
        by: a.performedBy || a.performedById?.name || 'System',
        at: a.createdAt
      }))
    : (lead.activity || []);

  const sa = await SuperAdmin.findOne().select('name').lean();
  const defaultOwner = sa?.name ? sa.name.replace(/sxsxsxdcdc/gi, '').replace(/\(Owner\)/gi, '').trim() || 'Meera Rao' : 'Meera Rao';

  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    ...lead,
    assignedTo: lead.assignedToId?.name || defaultOwner,
    assignedBy: lead.assignedById?.name || lead.createdById?.name || defaultOwner,
    branch: lead.branchId?.name || '',
    branchName: lead.branchId?.name || '',
    activity: activities,
    activities
  };
};

export const createNewLead = async (data, user) => {
  const leadNumber = await generateLeadNumber();
  let userId = toValidObjectId(user?._id || user?.id);
  if (!userId) {
    const adminUser = await SuperAdmin.findOne() || await User.findOne();
    if (adminUser) userId = adminUser._id;
  }
  const userName = user?.name || 'User';

  const assignedToId = toValidObjectId(data.assignedToId) || toValidObjectId(data.assignedTo) || userId;
  const assignedById = toValidObjectId(data.assignedById) || toValidObjectId(data.assignedBy) || userId;
  const contactName = data.name || data.contactPerson || 'Unnamed Lead';

  let assignedToName = 'Unassigned';
  if (assignedToId) {
    const target = await User.findById(assignedToId).select('name');
    if (target?.name) assignedToName = target.name;
  }
  let assignedByName = (typeof data.assignedBy === 'string' && !toValidObjectId(data.assignedBy)) ? data.assignedBy : userName;
  if (assignedById) {
    const assigner = await User.findById(assignedById).select('name');
    if (assigner?.name) assignedByName = assigner.name;
  }

  const initialActivities = [{
    type: 'CREATED',
    text: `Lead created by ${assignedByName} · Assigned to ${assignedToName}`,
    by: assignedByName,
    userId: assignedById || userId || null,
    at: new Date()
  }];

  const initialNotes = data.notes?.trim() ? [{
    text: data.notes.trim(),
    by: userName,
    userId: userId || null,
    at: new Date()
  }] : [];

  const initialStageHistory = [{
    stage: data.stage || 'New',
    by: userName,
    at: new Date()
  }];

  const lead = await Lead.create({
    leadNumber,
    name: contactName,
    company: data.company || data.companyName || '',
    phone: data.phone,
    email: data.email || '',
    city: data.city || '',
    state: data.state || '',
    district: data.district || '',
    pincode: data.pincode || '',
    siteLocation: data.siteLocation || data.address || '',
    source: data.source || 'Website',
    priority: data.priority || 'Warm',
    stage: data.stage || 'New',
    status: 'Active',
    active: true,
    kva: Number(data.kva) || null,
    quantity: Number(data.quantity) || 1,
    estimatedValue: Number(data.value || data.estimatedValue) || 0,
    expectedClose: data.expectedClose ? new Date(data.expectedClose) : null,
    branchId: toValidObjectId(data.branchId),
    assignedToId,
    assignedById,
    createdById: userId,
    notes: initialNotes,
    stageHistory: initialStageHistory,
    activity: initialActivities
  });

  // Write to separate LeadActivity collection/table
  await recordActivity({
    leadId: lead._id,
    type: 'CREATED',
    title: 'Lead Created',
    description: `Lead created by ${assignedByName} from ${lead.source || 'Website'} · Assigned to ${assignedToName}`,
    user
  });

  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    leadNumber: lead.leadNumber,
    name: lead.name,
    company: lead.company,
    stage: lead.stage
  };
};

export const updateLeadDetails = async (id, data, user) => {
  const lead = await Lead.findById(id);
  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  const userName = user?.name || 'User';
  const userId = toValidObjectId(user?._id || user?.id);
  const changes = [];

  if (data.name && data.name !== lead.name) {
    changes.push(`Name changed to "${data.name}"`);
    lead.name = data.name;
  }
  if (data.company !== undefined && data.company !== lead.company) {
    changes.push(`Company changed to "${data.company}"`);
    lead.company = data.company;
  }
  if (data.phone && data.phone !== lead.phone) {
    changes.push(`Mobile changed to ${data.phone}`);
    lead.phone = data.phone;
  }
  if (data.email !== undefined && data.email !== lead.email) {
    changes.push(`Email changed to ${data.email}`);
    lead.email = data.email;
  }
  if (data.priority && data.priority !== lead.priority) {
    changes.push(`Priority changed to ${data.priority}`);
    lead.priority = data.priority;
  }
  if (data.kva !== undefined && Number(data.kva) !== lead.kva) {
    changes.push(`Requirement changed to ${data.kva || 0} kVA`);
    lead.kva = Number(data.kva) || null;
  }
  if (data.quantity !== undefined && Number(data.quantity) !== lead.quantity) {
    changes.push(`Quantity changed to ${data.quantity}`);
    lead.quantity = Number(data.quantity) || 1;
  }
  const newValue = Number(data.value || data.estimatedValue);
  if (newValue !== undefined && newValue !== lead.estimatedValue) {
    changes.push(`Value updated to ₹${newValue.toLocaleString('en-IN')}`);
    lead.estimatedValue = newValue;
  }
  if (data.siteLocation !== undefined) lead.siteLocation = data.siteLocation;
  if (data.district !== undefined) lead.district = data.district;
  if (data.state !== undefined) lead.state = data.state;
  if (data.city !== undefined) lead.city = data.city;
  if (data.pincode !== undefined) lead.pincode = data.pincode;
  if (data.expectedClose !== undefined) lead.expectedClose = data.expectedClose ? new Date(data.expectedClose) : null;
  if (data.branchId && mongoose.Types.ObjectId.isValid(data.branchId)) lead.branchId = data.branchId;

  // Assigned To change
  const newAssignee = data.assignedToId || data.assignedTo;
  if (newAssignee && String(newAssignee) !== String(lead.assignedToId)) {
    if (mongoose.Types.ObjectId.isValid(newAssignee)) {
      lead.assignedToId = newAssignee;
      const assigner = data.assignedById || data.assignedBy || userId;
      if (assigner && mongoose.Types.ObjectId.isValid(assigner)) {
        lead.assignedById = assigner;
      }
      const targetUser = await User.findById(newAssignee).select('name');
      changes.push(`Assigned to ${targetUser?.name || 'Salesperson'}`);
    }
  }

  // Assigned By change
  const newAssigner = data.assignedById || data.assignedBy;
  if (newAssigner && String(newAssigner) !== String(lead.assignedById)) {
    if (mongoose.Types.ObjectId.isValid(newAssigner)) {
      lead.assignedById = newAssigner;
    }
  }

  if (!Array.isArray(lead.activity)) lead.activity = [];
  if (!Array.isArray(lead.notes)) lead.notes = [];
  if (!Array.isArray(lead.stageHistory)) lead.stageHistory = [];

  // Record Activity in Lead document array
  if (changes.length > 0) {
    lead.activity.unshift({
      type: 'EDITED',
      text: `Lead updated: ${changes.join(', ')}`,
      by: userName,
      userId,
      at: new Date()
    });

    // Write to separate LeadActivity collection/table
    await recordActivity({
      leadId: lead._id,
      type: 'EDITED',
      title: 'Lead Details Updated',
      description: changes.join(', '),
      user
    });
  }

  if (typeof data.notes === 'string' && data.notes.trim()) {
    lead.notes.unshift({
      text: data.notes.trim(),
      by: userName,
      userId,
      at: new Date()
    });
    lead.activity.unshift({
      type: 'NOTE_ADDED',
      text: `Note added: ${data.notes.trim().slice(0, 80)}`,
      by: userName,
      userId,
      at: new Date()
    });
    await recordActivity({
      leadId: lead._id,
      type: 'NOTE_ADDED',
      title: 'Note Added',
      description: data.notes.trim(),
      user
    });
  }

  await lead.save();

  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    name: lead.name,
    company: lead.company,
    stage: lead.stage
  };
};

export const updateStage = async (id, { stage, lossReason, notes }, user) => {
  const lead = await Lead.findById(id);
  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  const userName = user?.name || 'User';
  const userId = toValidObjectId(user?._id || user?.id);
  const oldStage = lead.stage;

  lead.stage = stage;
  if (stage === 'Lost') {
    lead.lossReason = lossReason || null;
    lead.status = 'Closed';
    if (lead.customerId) {
      try {
        const otherLeads = await Lead.countDocuments({ _id: { $ne: lead._id }, customerId: lead.customerId });
        if (otherLeads === 0) {
          await Customer.findByIdAndDelete(lead.customerId);
        }
      } catch (e) {
        logger.error('Error cleaning up customer on Lost stage:', e);
      }
      lead.customerId = null;
    }
  } else if (stage === 'Won') {
    lead.status = 'Converted';
    try {
      const compName = (lead.company || lead.name || '').trim();
      const existingCustomer = await Customer.findOne({
        $or: [
          { companyName: new RegExp(`^${compName}$`, 'i') },
          { name: new RegExp(`^${compName}$`, 'i') },
          { 'contacts.mobile': lead.phone }
        ]
      });
      if (!existingCustomer) {
        // Generate unique customerNumber
        const count = await Customer.countDocuments();
        const customerNumber = `CUST-${String(count + 1).padStart(4, '0')}`;

        const newCust = await Customer.create({
          customerNumber,
          name: compName,
          companyName: compName,
          type: lead.company ? 'Business' : 'Individual',
          segment: 'Industrial',
          branchId: lead.branchId || null,
          ownerId: lead.assignedToId || userId || null,
          siteAddresses: lead.siteLocation ? [lead.siteLocation] : [],
          city: lead.city || '',
          district: lead.district || '',
          state: lead.state || '',
          pincode: lead.pincode || '',
          active: true,
          contacts: [{
            name: lead.name || '',
            mobile: lead.phone || '',
            email: lead.email || '',
            primary: true
          }]
        });
        lead.customerId = newCust._id;
        await recordActivity({
          leadId: lead._id,
          type: 'STATUS_CHANGE',
          title: 'Customer Record Created',
          description: `Customer profile created: ${newCust.companyName}`,
          user
        });
      } else {
        // Link existing customer to this lead
        lead.customerId = existingCustomer._id;
      }
    } catch (e) {
      logger.error('Auto convert customer error on stage Won:', e);
    }
  }

  if (!Array.isArray(lead.stageHistory)) lead.stageHistory = [];
  if (!Array.isArray(lead.activity)) lead.activity = [];
  if (!Array.isArray(lead.notes)) lead.notes = [];

  lead.stageHistory.unshift({
    stage,
    by: userName,
    at: new Date()
  });

  lead.activity.unshift({
    type: 'STAGE_CHANGE',
    text: `Stage changed: ${oldStage} → ${stage}${lossReason ? ` (${lossReason})` : ''}`,
    by: userName,
    userId,
    at: new Date()
  });

  // Write to separate LeadActivity collection/table
  await recordActivity({
    leadId: lead._id,
    type: 'STAGE_CHANGE',
    title: `Stage Changed to ${stage}`,
    description: `Stage moved from ${oldStage} → ${stage}${lossReason ? ` (${lossReason})` : ''}`,
    user
  });

  await lead.save();

  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    stage: lead.stage,
    status: lead.status
  };
};

export const reassign = async (id, { assignedToId, assignedTo, reason }, user) => {
  const targetId = assignedToId || assignedTo;
  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    const error = new Error('Invalid user ID for reassignment');
    error.statusCode = 400;
    throw error;
  }

  const [lead, targetUser] = await Promise.all([
    Lead.findById(id),
    User.findById(targetId).select('name email')
  ]);

  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  const userName = user?.name || 'User';
  const userId = toValidObjectId(user?._id || user?.id);

  lead.assignedToId = targetId;
  lead.assignedById = userId;

  if (!Array.isArray(lead.activity)) lead.activity = [];

  lead.activity.unshift({
    type: 'REASSIGNED',
    text: `Reassigned to ${targetUser?.name || 'Salesperson'}${reason ? `: ${reason}` : ''}`,
    by: userName,
    userId,
    at: new Date()
  });

  // Write to separate LeadActivity collection/table
  await recordActivity({
    leadId: lead._id,
    type: 'REASSIGNED',
    title: 'Lead Reassigned',
    description: `Reassigned to ${targetUser?.name || 'Salesperson'}${reason ? `: ${reason}` : ''}`,
    user
  });

  await lead.save();

  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    assignedTo: targetUser?.name || null
  };
};

export const deleteLead = async (id, user) => {
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }
  // Also clean up activities
  await LeadActivity.deleteMany({ leadId: id });
  return { id, message: 'Lead deleted successfully' };
};
