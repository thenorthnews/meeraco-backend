import mongoose from 'mongoose';
import { Lead, User, Branch, Customer, LeadActivity, SuperAdmin, Quotation } from '../../models/index.js';
import logger from '../../helpers/logger.js';
import { getIO, emitCustomerCreated, emitCustomerUpdated } from '../../socket/socket.js';
import { createNotification, notifyManagersAndAdmins } from '../notification/notification.service.js';

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

export const fetchLeadActivities = async (leadId, { page = 1, limit = 5, filter } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 5);
  const skip = (pageNum - 1) * limitNum;

  const validLeadId = toValidObjectId(leadId);
  if (!validLeadId) {
    return { items: [], total: 0, page: pageNum, limit: limitNum, totalPages: 1 };
  }

  // 1. One-time auto backfill for existing leads that might not have activities recorded in LeadActivity yet
  const existingCount = await LeadActivity.countDocuments({ leadId: validLeadId });
  if (existingCount === 0) {
    const [leadDoc, quotes] = await Promise.all([
      Lead.findById(validLeadId).lean(),
      Quotation.find({ leadId: validLeadId }).lean()
    ]);
    if (leadDoc) {
      const backfill = [];
      backfill.push({
        leadId: validLeadId,
        type: 'CREATED',
        title: 'Lead Created',
        description: `Lead created for ${leadDoc.company || leadDoc.name || 'Client'}`,
        performedBy: leadDoc.createdBy || 'System',
        createdAt: leadDoc.createdAt || new Date()
      });
      (leadDoc.notes || []).forEach(n => {
        backfill.push({
          leadId: validLeadId,
          type: 'NOTE_ADDED',
          title: 'Note Added',
          description: typeof n === 'string' ? n : (n.text || ''),
          performedBy: n.by || 'User',
          createdAt: n.at || n.createdAt || new Date()
        });
      });
      (leadDoc.stageHistory || []).forEach(sh => {
        backfill.push({
          leadId: validLeadId,
          type: 'STAGE_CHANGE',
          title: `Stage Changed to ${sh.stage}`,
          description: `Stage moved to ${sh.stage}`,
          performedBy: sh.by || 'System',
          createdAt: sh.at || sh.createdAt || new Date()
        });
      });
      (quotes || []).forEach(q => {
        backfill.push({
          leadId: validLeadId,
          type: 'QUOTATION',
          title: `Quotation #${q.quoteNumber || q.number || ''}`,
          description: `Quotation status: ${q.status || 'Draft'} · Total: ₹${q.grandTotal || 0}`,
          performedBy: q.approvedBy || q.createdBy || 'Sales Executive',
          createdAt: q.createdAt || new Date()
        });
      });
      if (backfill.length > 0) {
        await LeadActivity.insertMany(backfill).catch(() => {});
      }
    }
  }

  const query = { leadId: validLeadId };

  // Filter support: 'all' | 'notes' | 'followups' | 'quotations'
  if (filter && filter !== 'all') {
    const f = filter.toLowerCase();
    if (f === 'notes' || f === 'note') {
      query.$or = [
        { type: { $in: ['NOTE_ADDED', 'NOTE'] } },
        { title: /note/i },
        { description: /note/i }
      ];
    } else if (f === 'followups' || f === 'followup' || f === 'follow_up') {
      query.$or = [
        { type: { $in: ['FOLLOW_UP', 'CALL'] } },
        { title: /follow/i },
        { description: /follow/i }
      ];
    } else if (f === 'quotations' || f === 'quotation' || f === 'quotes') {
      query.$or = [
        { type: 'QUOTATION' },
        { title: /quotation/i },
        { description: /quotation/i }
      ];
    }
  }

  const [total, rawItems] = await Promise.all([
    LeadActivity.countDocuments(query),
    LeadActivity.find(query)
      .populate('performedById', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
  ]);

  const items = rawItems.map(a => ({
    id: a._id.toString(),
    _id: a._id.toString(),
    type: a.type,
    title: a.title,
    description: a.description,
    performedBy: a.performedById?.name || a.performedBy || 'System',
    by: a.performedById?.name || a.performedBy || 'System',
    performedById: a.performedById?._id ? a.performedById._id.toString() : (a.performedById || null),
    createdAt: a.createdAt,
    at: a.createdAt
  }));

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1
  };
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
    if (stage.toLowerCase().includes('not qualified') || stage.toLowerCase() === 'not qualified') {
      query.$or = [
        { stage: new RegExp(`^${stage.trim()}$`, 'i') },
        { lossReason: /not qualified/i }
      ];
    } else if (stage.toLowerCase() === 'won' || stage.toLowerCase() === 'deal won') {
      query.$or = [
        { stage: /^(Won|Deal Won)$/i },
        { status: 'Converted' }
      ];
    } else {
      query.stage = new RegExp(`^${stage.trim()}$`, 'i');
    }
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
    const isManager = roleStr.includes('manager');

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
        : (isManager || roleStr.includes('executive'));

      const canViewAll = hasExplicitConfig
        ? perms.includes('view_all_leads')
        : isManager;

      // Find all team members reporting to this manager or in the same branch
      const teamMemberIds = [userObjId];
      if (isManager) {
        const teamQuery = {
          $or: [
            { managerId: userObjId },
            ...(userBranchId ? [{ branchId: userBranchId }] : [])
          ]
        };
        const teamUsers = await User.find(teamQuery).select('_id').lean();
        teamUsers.forEach(u => teamMemberIds.push(u._id));
      }

      const isMyLeadFilter = {
        $or: [
          { assignedToId: { $in: teamMemberIds } },
          { createdById: { $in: teamMemberIds } },
          { assignedById: { $in: teamMemberIds } },
          { ownerId: { $in: teamMemberIds } },
          ...(userBranchId ? [{ branchId: userBranchId }] : []),
          // CRITICAL: Won leads are ALWAYS visible to Sales Managers & Admins!
          ...(isManager ? [{ stage: /^(Won|Deal Won)$/i }, { status: 'Converted' }] : [])
        ]
      };

      const isOtherLeadFilter = {
        $and: [
          { assignedToId: { $nin: teamMemberIds } },
          { createdById: { $nin: teamMemberIds } }
        ]
      };

      if (canViewAssigned && canViewAll) {
      
      } else if (canViewAssigned && !canViewAll) {
        andClauses.push(isMyLeadFilter);
      } else if (!canViewAssigned && canViewAll) {
        andClauses.push(isOtherLeadFilter);
      } else {
        if (isManager) {
          andClauses.push({ $or: [{ stage: /^(Won|Deal Won)$/i }, { status: 'Converted' }] });
        } else {
          andClauses.push({ _id: new mongoose.Types.ObjectId() });
        }
      }
    }
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  const [total, rawLeads, superAdmins, allBranchesList] = await Promise.all([
    Lead.countDocuments(query),
    Lead.find(query)
      .select('-activity -stageHistory')
      .populate('assignedToId', 'name email mobile branchId')
      .populate('assignedById', 'name email mobile branchId')
      .populate('createdById', 'name email mobile branchId')
      .populate('branchId', 'name code districts states')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    SuperAdmin.find().select('name email mobile').lean(),
    Branch.find().select('name code districts states').lean()
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

    // Intelligent Branch Resolution
    let resolvedBranchName = l.branchId?.name || '';
    let resolvedBranchId = l.branchId?._id ? l.branchId._id.toString() : (l.branchId ? l.branchId.toString() : null);

    // Fallback 1: Assigned salesperson's branch
    if (!resolvedBranchName && l.assignedToId?.branchId) {
      const bObj = allBranchesList.find(b => String(b._id) === String(l.assignedToId.branchId._id || l.assignedToId.branchId));
      if (bObj) {
        resolvedBranchName = bObj.name;
        resolvedBranchId = bObj._id.toString();
      }
    }
    // Fallback 2: Creator user's branch
    if (!resolvedBranchName && l.createdById?.branchId) {
      const bObj = allBranchesList.find(b => String(b._id) === String(l.createdById.branchId._id || l.createdById.branchId));
      if (bObj) {
        resolvedBranchName = bObj.name;
        resolvedBranchId = bObj._id.toString();
      }
    }
    // Fallback 3: District / State mapping
    if (!resolvedBranchName && (l.district || l.state)) {
      const dMatch = allBranchesList.find(b =>
        (b.districts && (b.districts.includes(l.district) || b.districts.some(d => String(d).toLowerCase() === String(l.district || '').toLowerCase()))) ||
        (b.states && (b.states.includes(l.state) || b.states.some(s => String(s).toLowerCase() === String(l.state || '').toLowerCase())))
      );
      if (dMatch) {
        resolvedBranchName = dMatch.name;
        resolvedBranchId = dMatch._id.toString();
      }
    }
    // Fallback 4: Single branch company fallback
    if (!resolvedBranchName && allBranchesList.length === 1) {
      resolvedBranchName = allBranchesList[0].name;
      resolvedBranchId = allBranchesList[0]._id.toString();
    }
    if (!l.branchId && resolvedBranchId) {
      Lead.updateOne({ _id: l._id }, { $set: { branchId: resolvedBranchId } }).catch(() => {});
    }

    return {
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
      createdById: l.createdById?._id ? l.createdById._id.toString() : (l.createdById ? l.createdById.toString() : null),
      createdBy: l.createdById?.name || l.createdBy || '—',
      createdByName: l.createdById?.name || l.createdBy || '—',
      ownerId: aToId,
      branchId: resolvedBranchId,
      branch: resolvedBranchName || '—',
      branchName: resolvedBranchName || '—',
      lossReason: l.lossReason || null,
      quotationStatus: l.quotationStatus || 'None',
      quotationNumber: l.quotationNumber || null,
      quotationId: l.quotationId ? l.quotationId.toString() : null,
      quotationApprovedAt: l.quotationApprovedAt || null,
      quotationApprovedBy: l.quotationApprovedBy || null,
      quotationRejectedAt: l.quotationRejectedAt || null,
      quotationRejectedBy: l.quotationRejectedBy || null,
      quotationRejectionReason: l.quotationRejectionReason || null,
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
    : [];

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
  let userId = toValidObjectId(data.createdById) || toValidObjectId(user?._id || user?.id);
  if (!userId) {
    const adminUser = await SuperAdmin.findOne() || await User.findOne();
    if (adminUser) userId = adminUser._id;
  }
  const userName = data.createdByName || data.createdBy || user?.name || 'User';

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

  let leadBranchId = toValidObjectId(data.branchId);
  if (!leadBranchId) {
    if (assignedToId) {
      const aUser = await User.findById(assignedToId).select('branchId').lean();
      if (aUser?.branchId) leadBranchId = aUser.branchId;
    }
    if (!leadBranchId && userId) {
      const cUser = await User.findById(userId).select('branchId').lean();
      if (cUser?.branchId) leadBranchId = cUser.branchId;
    }
    if (!leadBranchId && (data.district || data.state)) {
      const dBranch = await Branch.findOne({
        $or: [
          ...(data.district ? [{ districts: data.district }] : []),
          ...(data.state ? [{ states: data.state }] : [])
        ]
      }).select('_id').lean();
      if (dBranch?._id) leadBranchId = dBranch._id;
    }
    if (!leadBranchId) {
      const firstBranch = await Branch.findOne().select('_id').lean();
      if (firstBranch?._id) leadBranchId = firstBranch._id;
    }
  }

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
    branchId: leadBranchId,
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

  // Notify assigned sales executive and managers
  try {
    if (assignedToId) {
      await createNotification({
        userId: assignedToId,
        title: '🎯 New Lead Assigned',
        message: `Lead "${contactName}" (${lead.company || lead.source || 'Direct'}) has been assigned to you by ${assignedByName}.`,
        type: 'lead_assigned',
        entityId: lead._id.toString(),
        entityType: 'lead',
        link: `/leads/${lead._id}`
      });
    }

    await notifyManagersAndAdmins({
      branchId: lead.branchId,
      title: '🆕 New Lead Created',
      message: `Lead "${contactName}" (${lead.company || lead.source || 'Direct'}) created by ${assignedByName} and assigned to ${assignedToName}.`,
      type: 'general',
      entityId: lead._id.toString(),
      entityType: 'lead',
      link: `/leads/${lead._id}`
    });
  } catch (err) {
    logger.warn('Failed to send lead creation notification:', err.message);
  }

  const io = getIO();
  if (io) {
    io.emit('lead:created', lead);
  }

  return {
    id: lead._id.toString(),
    _id: lead._id.toString(),
    leadNumber: lead.leadNumber,
    name: lead.name,
    company: lead.company,
    stage: lead.stage,
    kva: lead.kva,
    quantity: lead.quantity,
    estimatedValue: lead.estimatedValue,
    branchId: lead.branchId ? lead.branchId.toString() : null,
    assignedToId: lead.assignedToId ? lead.assignedToId.toString() : null,
    assignedTo: assignedToName,
    assignedById: lead.assignedById ? lead.assignedById.toString() : null,
    assignedBy: assignedByName,
    createdById: lead.createdById ? lead.createdById.toString() : null,
    createdBy: assignedByName,
    createdByName: assignedByName,
    ownerId: lead.assignedToId ? lead.assignedToId.toString() : null
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

  if (!Array.isArray(lead.notes)) lead.notes = [];
  if (!Array.isArray(lead.stageHistory)) lead.stageHistory = [];

  // Record Activity in separate LeadActivity collection/table
  if (changes.length > 0) {
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
    await recordActivity({
      leadId: lead._id,
      type: 'NOTE_ADDED',
      title: 'Note Added',
      description: data.notes.trim(),
      user
    });

    // Notify assigned salesperson or creator if note added by someone else
    try {
      const recipientId = (lead.assignedToId && String(lead.assignedToId) !== String(userId))
        ? lead.assignedToId
        : (lead.createdById && String(lead.createdById) !== String(userId))
        ? lead.createdById
        : null;

      if (recipientId) {
        await createNotification({
          userId: recipientId,
          title: '💬 New Note on Lead',
          message: `${userName} added a note on "${lead.name}": "${data.notes.trim().slice(0, 60)}..."`,
          type: 'general',
          entityId: lead._id.toString(),
          entityType: 'lead',
          link: `/leads/${lead._id}`
        });
      }
    } catch (err) {
      logger.warn('Failed to send note notification:', err.message);
    }
  }

  await lead.save();

  try {
    const io = getIO();
    if (io) {
      io.emit('lead:updated', lead);
    }
  } catch (err) {
    logger.warn('Failed to emit lead:updated socket event:', err.message);
  }

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

  // Enforce Quotation Approval Workflow:
  // Negotiation stage requires Quotation to be Approved by Sales Manager or Admin
  const userRole = (user?.role || user?.roleName || '').toLowerCase();
  const isManagerOrAdmin = userRole.includes('admin') || userRole.includes('manager') || userRole.includes('owner');

  if (stage === 'Negotiation') {
    const approvedQuote = await Quotation.findOne({
      leadId: lead._id,
      status: { $in: ['Approved', 'Sent', 'Accepted'] }
    });
    if (!approvedQuote && !isManagerOrAdmin) {
      const error = new Error('Quotation approval from Sales Manager or Admin is strictly required before moving to Negotiation stage.');
      error.statusCode = 400;
      throw error;
    }
  } else if (stage === 'Won') {
    const approvedQuote = await Quotation.findOne({
      leadId: lead._id,
      status: { $in: ['Approved', 'Sent', 'Accepted'] }
    });
    if (!approvedQuote) {
      const error = new Error('Cannot mark deal as Won without an Approved Quotation from Sales Manager / Admin.');
      error.statusCode = 400;
      throw error;
    }
  }

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
      let targetBranchId = toValidObjectId(lead.branchId?._id || lead.branchId);
      if (!targetBranchId && lead.assignedToId) {
        const aUser = await User.findById(lead.assignedToId).select('branchId').lean();
        if (aUser?.branchId) targetBranchId = aUser.branchId;
      }
      if (!targetBranchId && userId) {
        const uUser = await User.findById(userId).select('branchId').lean();
        if (uUser?.branchId) targetBranchId = uUser.branchId;
      }

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
          source: 'Won deal',
          branchId: targetBranchId || null,
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
        try {
          emitCustomerCreated(newCust);
        } catch (scErr) {
          console.warn('Socket emit error:', scErr.message);
        }
      } else {
        // Link existing customer to this lead
        lead.customerId = existingCustomer._id;
        existingCustomer.source = 'Won deal';
        if (!existingCustomer.branchId && targetBranchId) {
          existingCustomer.branchId = targetBranchId;
        }
        await existingCustomer.save();
        try {
          emitCustomerUpdated(existingCustomer);
        } catch (scErr) {
          console.warn('Socket emit error:', scErr.message);
        }
      }

      // Sync approved/accepted quotation products into customer profile
      const targetCustId = lead.customerId;
      if (targetCustId) {
        const leadQuotes = await Quotation.find({
          leadId: lead._id,
          $or: [
            { status: { $in: ['Accepted', 'Won', 'Sent', 'Approved'] } },
            { approvalStatus: 'Approved' }
          ]
        }).lean();

        if (leadQuotes.length > 0) {
          const custDoc = await Customer.findById(targetCustId);
          if (custDoc) {
            if (!Array.isArray(custDoc.products)) custDoc.products = [];
            const existingKeys = new Set(custDoc.products.map(p => `${p.quoteNumber || ''}_${p.name}`));
            leadQuotes.forEach(q => {
              (q.items || []).forEach(it => {
                const desc = it.description || 'Genset Equipment';
                const key = `${q.quoteNumber || ''}_${desc}`;
                if (!existingKeys.has(key)) {
                  existingKeys.add(key);
                  const kvaMatch = desc.match(/(\d+(\.\d+)?\s*kVA)/i);
                  custDoc.products.push({
                    name: desc,
                    kva: it.kva || (kvaMatch ? kvaMatch[1] : ''),
                    model: desc,
                    qty: it.quantity || 1,
                    rate: it.total || it.unitPrice || 0,
                    purchaseDate: q.approvedAt || new Date(),
                    status: 'Under Warranty',
                    quoteNumber: q.quoteNumber || '',
                    notes: `From Quotation ${q.quoteNumber || ''}`
                  });
                }
              });
            });
            await custDoc.save();
          }
        }
      }
    } catch (e) {
      logger.error('Auto convert customer error on stage Won:', e);
    }
  }

  if (!Array.isArray(lead.stageHistory)) lead.stageHistory = [];
  if (!Array.isArray(lead.notes)) lead.notes = [];

  lead.stageHistory.unshift({
    stage,
    by: userName,
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

  // Notify team/managers of stage progress
  try {
    if (stage === 'Won') {
      await notifyManagersAndAdmins({
        branchId: lead.branchId,
        title: '🎉 Deal Closed - WON!',
        message: `Deal for "${lead.name || lead.company}" has been closed as WON by ${userName}!`,
        type: 'deal_won',
        entityId: lead._id.toString(),
        entityType: 'lead',
        link: `/leads/${lead._id}`
      });
    } else if (stage === 'Qualified') {
      await notifyManagersAndAdmins({
        branchId: lead.branchId,
        title: '🎯 Lead Qualified',
        message: `Lead "${lead.name || lead.company}" marked as QUALIFIED by ${userName}. Ready for quotation.`,
        type: 'general',
        entityId: lead._id.toString(),
        entityType: 'lead',
        link: `/leads/${lead._id}`
      });
    }
  } catch (err) {
    logger.warn('Failed to send stage change notification:', err.message);
  }

  try {
    const io = getIO();
    if (io) {
      io.emit('lead:stage_changed', {
        id: lead._id.toString(),
        leadId: lead._id.toString(),
        stage: lead.stage,
        status: lead.status,
        by: userName
      });
      io.emit('lead:updated', lead);
    }
  } catch (err) {
    logger.warn('Failed to emit lead:stage_changed socket event:', err.message);
  }

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

  // Write to separate LeadActivity collection/table
  await recordActivity({
    leadId: lead._id,
    type: 'REASSIGNED',
    title: 'Lead Reassigned',
    description: `Reassigned to ${targetUser?.name || 'Salesperson'}${reason ? `: ${reason}` : ''}`,
    user
  });

  await lead.save();

  // Notify newly assigned user
  try {
    await createNotification({
      userId: targetId,
      title: '🔄 Lead Reassigned to You',
      message: `Lead "${lead.name}" (${lead.company || ''}) has been reassigned to you by ${userName}${reason ? `. Reason: ${reason}` : ''}.`,
      type: 'lead_assigned',
      entityId: lead._id.toString(),
      entityType: 'lead',
      link: `/leads/${lead._id}`
    });
  } catch (err) {
    logger.warn('Failed to send reassignment notification:', err.message);
  }

  try {
    const io = getIO();
    if (io) {
      io.emit('lead:assigned', {
        id: lead._id.toString(),
        leadId: lead._id.toString(),
        assignedToId: targetId
      });
      io.emit('lead:updated', lead);
    }
  } catch (err) {
    logger.warn('Failed to emit lead:assigned socket event:', err.message);
  }

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

  // Broadcast deletion in real-time to all clients (Admin, Sales Managers, Executives)
  try {
    const io = getIO();
    if (io) {
      const leadIdStr = lead._id.toString();
      io.emit('lead:deleted', {
        id: leadIdStr,
        leadId: leadIdStr,
        leadNumber: lead.leadNumber,
        name: lead.name,
        deletedBy: user?.name || 'User'
      });
    }
  } catch (err) {
    logger.warn('Failed to emit lead:deleted socket event:', err.message);
  }

  return { id: lead._id.toString(), message: 'Lead deleted successfully' };
};
