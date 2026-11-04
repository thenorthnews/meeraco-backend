import { Lead, User, Branch } from '../../models/index.js';
import logger from '../../helpers/logger.js';

export const generateLeadNumber = async () => {
  const count = await Lead.countDocuments();
  return `LD-${String(count + 1).padStart(5, '0')}`;
};

export const fetchLeads = async ({ stage, branchId, assignedToId, search, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (stage) query.stage = stage;
  if (branchId) query.branchId = branchId;
  if (assignedToId) query.assignedToId = assignedToId;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { leadNumber: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const [total, leads] = await Promise.all([
    Lead.countDocuments(query),
    Lead.find(query)
      .populate('assignedToId', 'name email mobile')
      .populate('branchId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
  ]);

  return {
    leads: leads.map(l => ({
      id: l._id.toString(),
      leadNumber: l.leadNumber,
      title: l.title,
      company: l.company,
      contactName: l.contactName,
      phone: l.phone,
      email: l.email,
      stage: l.stage,
      status: l.status,
      kva: l.kva,
      estimatedValue: l.estimatedValue,
      assignedTo: l.assignedToId ? { name: l.assignedToId.name, email: l.assignedToId.email } : null,
      branch: l.branchId ? { name: l.branchId.name, code: l.branchId.code } : null,
      createdAt: l.createdAt
    })),
    total,
    pageNum,
    limitNum
  };
};

export const fetchLeadById = async (id) => {
  const lead = await Lead.findById(id)
    .populate('assignedToId', 'name email mobile')
    .populate('branchId', 'name code')
    .lean();

  if (!lead) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: lead._id.toString(),
    ...lead
  };
};

export const createNewLead = async (data, creatorId) => {
  const leadNumber = await generateLeadNumber();

  const lead = await Lead.create({
    leadNumber,
    title: data.title,
    company: data.company,
    contactName: data.contactName || '',
    phone: data.phone,
    email: data.email || '',
    city: data.city || '',
    state: data.state || '',
    district: data.district || '',
    source: data.source || 'Direct',
    segment: data.segment || 'Industrial',
    stage: 'New',
    status: 'Open',
    kva: data.kva || null,
    estimatedValue: data.estimatedValue || 0,
    assignedToId: data.assignedToId || creatorId || null,
    branchId: data.branchId || null
  });

  return {
    id: lead._id.toString(),
    leadNumber: lead.leadNumber,
    title: lead.title,
    company: lead.company,
    stage: lead.stage
  };
};

export const updateLeadStage = async (id, { stage, lostReason }) => {
  const updateData = { stage };
  if (['Won', 'Lost', 'Dropped'].includes(stage)) {
    updateData.status = stage === 'Won' ? 'Converted' : 'Closed';
  }

  const updated = await Lead.findByIdAndUpdate(id, { $set: updateData }, { new: true });
  if (!updated) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: updated._id.toString(),
    stage: updated.stage,
    status: updated.status
  };
};

export const reassignLead = async (id, { newAssigneeId, reason }) => {
  const updated = await Lead.findByIdAndUpdate(
    id,
    { $set: { assignedToId: newAssigneeId } },
    { new: true }
  ).populate('assignedToId', 'name email');

  if (!updated) {
    const error = new Error('Lead not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: updated._id.toString(),
    assignedTo: updated.assignedToId ? updated.assignedToId.name : null
  };
};
