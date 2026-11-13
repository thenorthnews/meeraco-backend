import mongoose from 'mongoose';
import { Lead, Quotation, Branch, User, SuperAdmin, LeadActivity } from '../../models/index.js';

/**
 * Compute Period Date Range
 */
const getPeriodStartDate = (period) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
      return null;
    default:
      return new Date(now.getFullYear(), 0, 1);
  }
};

/**
 * Fetch Comprehensive Dashboard Data
 */
export const fetchDashboardData = async ({ period = 'year', branchId, user }) => {
  const fromDate = getPeriodStartDate(period);
  const leadQuery = {};

  if (fromDate) {
    leadQuery.createdAt = { $gte: fromDate };
  }

  // Branch filter resolution
  let branchObjectId = null;
  if (branchId && branchId !== 'All' && branchId !== 'all') {
    if (mongoose.Types.ObjectId.isValid(branchId)) {
      branchObjectId = new mongoose.Types.ObjectId(branchId);
    } else {
      const bMatch = await Branch.findOne({ $or: [{ name: branchId }, { code: branchId }] });
      if (bMatch) branchObjectId = bMatch._id;
    }
  }

  if (branchObjectId) {
    leadQuery.branchId = branchObjectId;
  }

  // Role Scoping
  if (user && user.role) {
    const roleCode = (user.role.code || user.role.name || '').toLowerCase();
    if (roleCode.includes('executive')) {
      leadQuery.assignedToId = user._id || user.id;
    } else if (roleCode.includes('manager') && !branchObjectId) {
      if (user.branchId) {
        leadQuery.$or = [{ branchId: user.branchId }, { assignedToId: user._id || user.id }];
      } else {
        leadQuery.assignedToId = user._id || user.id;
      }
    }
  }

  // Fetch leads and supporting records
  const [rawLeads, rawBranches, rawUsers, superAdmins, rawQuotes, recentActivities] = await Promise.all([
    Lead.find(leadQuery)
      .populate('branchId', 'name code')
      .populate('assignedToId', 'name email mobile')
      .populate('assignedById', 'name email mobile')
      .populate('createdById', 'name email mobile')
      .sort({ createdAt: -1 })
      .lean(),
    Branch.find({ active: { $ne: false } }).select('name code active').lean(),
    User.find({ active: { $ne: false } }).select('name email mobile branchId roleId').lean(),
    SuperAdmin.find().select('name email mobile').lean(),
    Quotation.find(branchObjectId ? { branchId: branchObjectId } : {}).sort({ createdAt: -1 }).lean(),
    LeadActivity.find().sort({ createdAt: -1 }).limit(20).lean()
  ]);

  const defaultOwnerName = superAdmins[0]?.name?.replace(/sxsxsxdcdc/gi, '')?.replace(/\(Owner\)/gi, '')?.trim() || user?.name || 'Meera Rao';

  // Format leads for frontend consistency
  const leads = rawLeads.map(l => {
    const val = Number(l.estimatedValue || l.value) || 0;
    const aTo = l.assignedToId?.name || defaultOwnerName;
    const aBy = l.assignedById?.name || l.createdById?.name || defaultOwnerName;
    const brName = l.branchId?.name || '';
    const brId = l.branchId?._id?.toString() || (l.branchId ? l.branchId.toString() : '');

    return {
      id: l._id.toString(),
      _id: l._id.toString(),
      leadNumber: l.leadNumber,
      name: l.name || l.contactPerson || 'Unnamed',
      company: l.company || '',
      phone: l.phone || '',
      email: l.email || '',
      stage: l.stage || 'New',
      priority: l.priority || 'Warm',
      source: l.source || 'Website',
      status: l.status || 'Active',
      value: val,
      estimatedValue: val,
      kva: l.kva || null,
      quantity: l.quantity || 1,
      branchId: brId,
      branch: brName,
      assignedToId: l.assignedToId?._id?.toString() || (l.assignedToId ? l.assignedToId.toString() : null),
      assignedTo: aTo,
      assignedById: l.assignedById?._id?.toString() || (l.assignedById ? l.assignedById.toString() : null),
      assignedBy: aBy,
      notes: l.notes || [],
      stageHistory: l.stageHistory || [],
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    };
  });

  const leadIdSet = new Set(leads.map(l => l.id));
  const quotes = rawQuotes.filter(q => {
    const qLeadId = q.leadId?.toString();
    return qLeadId && leadIdSet.has(qLeadId);
  }).map(q => ({
    id: q._id.toString(),
    _id: q._id.toString(),
    quoteNumber: q.quoteNumber,
    leadId: q.leadId?.toString(),
    status: q.status || 'Draft',
    subtotal: q.subtotal || 0,
    grandTotal: q.grandTotal || 0,
    total: q.grandTotal || q.subtotal || 0,
    items: q.items || [],
    createdAt: q.createdAt,
    updatedAt: q.updatedAt
  }));

  // KPI Calculations
  const now = new Date();
  const openLeads = leads.filter(l => !['won', 'lost', 'closed'].includes((l.stage || '').toLowerCase()));
  const wonLeads = leads.filter(l => (l.stage || '').toLowerCase() === 'won');
  const lostLeads = leads.filter(l => (l.stage || '').toLowerCase() === 'lost');

  const totalLeads = leads.length;
  const openLeadsCount = openLeads.length;
  const wonCount = wonLeads.length;
  const lostCount = lostLeads.length;

  const pipelineValue = openLeads.reduce((s, l) => s + (l.value || 0), 0);
  const wonValue = wonLeads.reduce((s, l) => s + (l.value || 0), 0);
  const totalValue = leads.reduce((s, l) => s + (l.value || 0), 0);

  const decidedCount = wonCount + lostCount;
  const winRate = decidedCount > 0 ? Math.round((wonCount / decidedCount) * 100) : 0;

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = leads.filter(l => new Date(l.createdAt) >= startOfMonth).length;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newLast7Days = leads.filter(l => new Date(l.createdAt) >= sevenDaysAgo).length;

  // Average Lead Age (in days for open leads)
  let avgLeadAge = 0;
  if (openLeads.length > 0) {
    const totalAgeMs = openLeads.reduce((s, l) => s + (now.getTime() - new Date(l.createdAt).getTime()), 0);
    avgLeadAge = Math.round(totalAgeMs / (openLeads.length * 24 * 60 * 60 * 1000));
  }

  // Pipeline by Stage
  const stageMap = new Map();
  leads.forEach(l => {
    const stg = l.stage || 'New';
    if (!stageMap.has(stg)) {
      stageMap.set(stg, { stage: stg, count: 0, value: 0 });
    }
    const item = stageMap.get(stg);
    item.count += 1;
    item.value += l.value;
  });
  const pipelineByStage = Array.from(stageMap.values()).map(s => ({
    ...s,
    percentage: totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0
  }));

  // Sourced Pipeline
  const sourceMap = new Map();
  leads.forEach(l => {
    const src = l.source || 'Website';
    if (!sourceMap.has(src)) {
      sourceMap.set(src, { source: src, count: 0, value: 0, wonCount: 0, wonValue: 0 });
    }
    const item = sourceMap.get(src);
    item.count += 1;
    item.value += l.value;
    if ((l.stage || '').toLowerCase() === 'won') {
      item.wonCount += 1;
      item.wonValue += l.value;
    }
  });
  const sourcedPipeline = Array.from(sourceMap.values()).map(s => ({
    ...s,
    winRate: s.count > 0 ? Math.round((s.wonCount / s.count) * 100) : 0
  }));

  // Performers by Salesperson
  const userMap = new Map();
  leads.forEach(l => {
    const uname = l.assignedTo || 'Unassigned';
    if (!userMap.has(uname)) {
      userMap.set(uname, {
        id: l.assignedToId || uname,
        name: uname,
        totalLeads: 0,
        openLeads: 0,
        wonLeads: 0,
        lostLeads: 0,
        wonValue: 0,
        pipelineValue: 0
      });
    }
    const u = userMap.get(uname);
    u.totalLeads += 1;
    const stgLower = (l.stage || '').toLowerCase();
    if (stgLower === 'won') {
      u.wonLeads += 1;
      u.wonValue += l.value;
    } else if (stgLower === 'lost') {
      u.lostLeads += 1;
    } else {
      u.openLeads += 1;
      u.pipelineValue += l.value;
    }
  });
  const performersBySalesperson = Array.from(userMap.values()).map(u => {
    const decided = u.wonLeads + u.lostLeads;
    return {
      ...u,
      winRate: decided > 0 ? Math.round((u.wonLeads / decided) * 100) : 0
    };
  }).sort((a, b) => b.wonValue - a.wonValue || b.totalLeads - a.totalLeads);

  // Performers by Branch
  const branchPerfMap = new Map();
  leads.forEach(l => {
    const bname = l.branch || 'Unassigned';
    if (!branchPerfMap.has(bname)) {
      branchPerfMap.set(bname, {
        id: l.branchId || bname,
        name: bname,
        totalLeads: 0,
        openLeads: 0,
        wonLeads: 0,
        lostLeads: 0,
        wonValue: 0,
        pipelineValue: 0
      });
    }
    const b = branchPerfMap.get(bname);
    b.totalLeads += 1;
    const stgLower = (l.stage || '').toLowerCase();
    if (stgLower === 'won') {
      b.wonLeads += 1;
      b.wonValue += l.value;
    } else if (stgLower === 'lost') {
      b.lostLeads += 1;
    } else {
      b.openLeads += 1;
      b.pipelineValue += l.value;
    }
  });
  const performersByBranch = Array.from(branchPerfMap.values()).map(b => {
    const decided = b.wonLeads + b.lostLeads;
    return {
      ...b,
      winRate: decided > 0 ? Math.round((b.wonLeads / decided) * 100) : 0
    };
  }).sort((a, b) => b.wonValue - a.wonValue || b.totalLeads - a.totalLeads);

  // Monthly Lead Trend (Last 12 months)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = `${monthNames[m]} ${String(y).slice(-2)}`;

    const monthLeads = leads.filter(l => {
      const ld = new Date(l.createdAt);
      return ld.getFullYear() === y && ld.getMonth() === m;
    });

    const mTotal = monthLeads.length;
    const mWon = monthLeads.filter(l => (l.stage || '').toLowerCase() === 'won');
    const mLost = monthLeads.filter(l => (l.stage || '').toLowerCase() === 'lost');
    const mOpen = monthLeads.filter(l => !['won', 'lost', 'closed'].includes((l.stage || '').toLowerCase()));

    monthlyTrend.push({
      key,
      label,
      total: mTotal,
      won: mWon.length,
      lost: mLost.length,
      open: mOpen.length,
      wonValue: mWon.reduce((s, l) => s + l.value, 0),
      openValue: mOpen.reduce((s, l) => s + l.value, 0)
    });
  }

  // Quotation Statistics
  const quotationStats = {
    totalQuotes: quotes.length,
    draftQuotes: quotes.filter(q => q.status === 'Draft').length,
    sentQuotes: quotes.filter(q => q.status === 'Sent').length,
    acceptedQuotes: quotes.filter(q => q.status === 'Accepted').length,
    rejectedQuotes: quotes.filter(q => q.status === 'Rejected').length,
    totalQuoteValue: quotes.reduce((s, q) => s + (q.grandTotal || q.subtotal || 0), 0)
  };

  return {
    period,
    branchId: branchId || null,
    kpis: {
      totalLeads,
      openLeadsCount,
      pipelineValue,
      wonCount,
      lostCount,
      wonValue,
      totalValue,
      winRate,
      newThisMonth,
      newLast7Days,
      avgLeadAge
    },
    pipelineByStage,
    sourcedPipeline,
    performersBySalesperson,
    performersByBranch,
    monthlyTrend,
    quotationStats,
    branches: rawBranches.map(b => ({
      id: b._id.toString(),
      _id: b._id.toString(),
      name: b.name,
      code: b.code
    })),
    recentActivities: recentActivities.map(a => ({
      id: a._id.toString(),
      leadId: a.leadId?.toString(),
      type: a.type,
      title: a.title,
      description: a.description,
      performedBy: a.performedBy,
      createdAt: a.createdAt
    })),
    leads,
    quotes
  };
};

