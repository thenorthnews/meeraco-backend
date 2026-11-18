import mongoose from 'mongoose';
import { Quotation, Lead, LeadActivity, Customer, User } from '../../models/index.js';
import { getIO, emitCustomerCreated, emitCustomerUpdated } from '../../socket/socket.js';
import { recordActivity } from '../lead/lead.service.js';
import { createNotification, notifyManagersAndAdmins } from '../notification/notification.service.js';

export const generateQuoteNumber = async () => {
  const count = await Quotation.countDocuments();
  return `MEE-Q-${String(count + 1).padStart(5, '0')}`;
};

export const fetchQuotations = async ({ status, branchId, leadId, customerId, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status;
  if (branchId) query.branchId = branchId;
  if (leadId) query.leadId = leadId;
  if (customerId) query.customerId = customerId;

  const [total, quotes] = await Promise.all([
    Quotation.countDocuments(query),
    Quotation.find(query)
      .populate({
        path: 'leadId',
        select: 'leadNumber title company branchId',
        populate: { path: 'branchId', select: 'name code' }
      })
      .populate('customerId', 'customerNumber companyName')
      .populate('branchId', 'name code')
      .populate('createdById', 'name email')
      .populate('approvedById', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
  ]);

  return {
    quotations: quotes.map(q => {
      const items = Array.isArray(q.items) ? q.items : [];
      const lineDisc = items.find(it => (it.discountPct || 0) > 0)?.discountPct;
      const calcPct = (q.subtotal > 0 && q.discountTotal > 0) ? Math.round((q.discountTotal / q.subtotal) * 100) : 0;
      const discountPct = lineDisc != null ? lineDisc : calcPct;

      const branchObj = q.branchId || q.leadId?.branchId;
      const branchName = branchObj?.name || branchObj?.code || '—';
      const branchIdStr = branchObj?._id ? branchObj._id.toString() : (typeof q.branchId === 'string' ? q.branchId : (q.branchId ? q.branchId.toString() : null));

      return {
        id: q._id.toString(),
        quoteNumber: q.quoteNumber,
        number: q.quoteNumber,
        revision: q.revision,
        status: q.status,
        grandTotal: q.grandTotal,
        discountTotal: q.discountTotal || 0,
        discountPct: discountPct || 0,
        subtotal: q.subtotal || 0,
        branchId: branchIdStr,
        branchName: branchName,
        branch: branchName,
        leadId: q.leadId?._id ? q.leadId._id.toString() : q.leadId,
        createdBy: q.createdById?.name || q.preparedBy || '—',
        createdById: q.createdById?._id || q.createdById,
        approvedBy: q.approvedBy || q.approvedById?.name || (q.status === 'Approved' ? 'Sales Manager' : '—'),
        approvedById: q.approvedById?._id || q.approvedById,
        approvalStatus: q.approvalStatus || (q.status === 'Approved' ? 'Approved' : (q.status === 'Draft' ? 'Draft' : 'Pending')),
        company: q.customerId?.companyName || q.leadId?.company || '—',
        createdAt: q.createdAt,
        revisions: q.revisions || []
      };
    }),
    total,
    pageNum,
    limitNum
  };
};

export const fetchQuotationById = async (id) => {
  let quote = null;
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    quote = await Quotation.findById(id)
      .populate('leadId')
      .populate('customerId')
      .populate('branchId')
      .populate('createdById', 'name email')
      .lean();
  }

  if (!quote && id) {
    quote = await Quotation.findOne({
      $or: [
        { quoteNumber: id },
        { quoteNumber: new RegExp(`^${id}$`, 'i') }
      ]
    })
      .populate('leadId')
      .populate('customerId')
      .populate('branchId')
      .populate('createdById', 'name email')
      .lean();
  }

  if (!quote) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: quote._id.toString(),
    ...quote
  };
};

export const updateQuotationContent = async (id, data, user = null) => {
  let quote = null;

  // 1. Try finding by MongoDB ObjectId
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    quote = await Quotation.findById(id);
  }

  // 2. Try finding by quoteNumber
  if (!quote && id) {
    quote = await Quotation.findOne({
      $or: [
        { quoteNumber: id },
        { quoteNumber: new RegExp(`^${id}$`, 'i') },
        { quoteNumber: new RegExp(id, 'i') }
      ]
    });
  }

  // 3. Try finding by leadId
  const effectiveLeadId = data.leadId || (id && mongoose.Types.ObjectId.isValid(id) ? id : null);
  if (!quote && effectiveLeadId && mongoose.Types.ObjectId.isValid(effectiveLeadId)) {
    quote = await Quotation.findOne({ leadId: effectiveLeadId });
  }

  // Prevent any modifications if quotation is already WON / Accepted
  if (quote && (quote.status === 'Accepted' || quote.approvalStatus === 'Accepted')) {
    const err = new Error('Quotation is already Won / Accepted and cannot be edited or revised.');
    err.statusCode = 400;
    throw err;
  }

  const rawItems = Array.isArray(data.lines) ? data.lines : (Array.isArray(data.items) ? data.items : []);
  let subtotal = 0;
  let discountTotal = 0;
  let totalTax = 0;

  const items = rawItems.map(item => {
    const qty = Math.max(1, Number(item.qty ?? item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.rate ?? item.unitPrice) || 0);
    const discountPct = (item.discValue != null || item.discountPct != null)
      ? Math.max(0, Math.min(100, Number(item.discValue ?? item.discountPct) || 0))
      : 5;
    const gstPct = Math.max(0, Math.min(28, Number(item.gstPct) || 18));

    const lineGross = qty * unitPrice;
    const lineDiscount = lineGross * (discountPct / 100);
    const lineTaxable = lineGross - lineDiscount;
    const lineTax = lineTaxable * (gstPct / 100);
    const lineTotal = lineTaxable + lineTax;

    subtotal += lineGross;
    discountTotal += lineDiscount;
    totalTax += lineTax;

    return {
      description: item.description || 'Genset Equipment',
      quantity: qty,
      unitPrice,
      discountPct,
      gstPct,
      total: Math.round(lineTotal)
    };
  });

  const grandTotal = Math.round(subtotal - discountTotal + totalTax);

  // If quote does not exist, create new
  if (!quote) {
    const quoteNumber = await generateQuoteNumber();
    let branchId = data.branchId || null;
    if (!branchId && effectiveLeadId) {
      const linkedLead = await Lead.findById(effectiveLeadId).select('branchId');
      if (linkedLead?.branchId) branchId = linkedLead.branchId;
    }
    quote = new Quotation({
      quoteNumber,
      leadId: effectiveLeadId,
      customerId: data.customerId || null,
      branchId,
      createdById: user?._id || user?.id || null,
      revision: 0,
      status: data.status || 'Draft'
    });
  } else {
    // If existing quote has no branchId, set from data or linked lead
    if (!quote.branchId) {
      let bId = data.branchId || null;
      if (!bId && effectiveLeadId) {
        const linkedLead = await Lead.findById(effectiveLeadId).select('branchId');
        if (linkedLead?.branchId) bId = linkedLead.branchId;
      }
      if (bId) quote.branchId = bId;
    }
    // If quote already exists, archive current snapshot in revisions before bumping
    if (!Array.isArray(quote.revisions)) quote.revisions = [];
    quote.revisions.unshift({
      revision: quote.revision || 0,
      subtotal: quote.subtotal || 0,
      discountTotal: quote.discountTotal || 0,
      grandTotal: quote.grandTotal || 0,
      status: quote.status || 'Draft',
      savedAt: quote.updatedAt || new Date(),
      by: user?.name || 'Sales Executive',
      items: quote.items || []
    });

    // Bump revision
    quote.revision = (quote.revision || 0) + 1;
    if (data.status) {
      quote.status = data.status;
    } else if (quote.status === 'Rejected') {
      quote.status = 'Draft';
    }
  }

  quote.items = items;
  quote.subtotal = Math.round(subtotal);
  quote.discountTotal = Math.round(discountTotal);
  quote.igst = Math.round(totalTax);
  quote.grandTotal = grandTotal;
  quote.approvalStatus = quote.status === 'Pending Approval' ? 'Pending' : (quote.status === 'Approved' ? 'Approved' : (quote.status === 'Draft' ? 'Draft' : 'Pending'));
  quote.rejectionReason = ''; // Clear previous rejection reason upon revision
  quote.rejectedBy = null;
  quote.rejectedAt = null;

  await quote.save();

  // Synchronize with linked lead
  if (quote.leadId) {
    const lead = await Lead.findById(quote.leadId);
    if (lead) {
      lead.estimatedValue = grandTotal;
      lead.quotationStatus = quote.status;
      lead.quotationNumber = quote.quoteNumber;
      lead.quotationId = quote._id;
      lead.quotationRejectionReason = null; // Clear rejection reason on lead

      const userName = user?.name || 'Sales Executive';
      await recordActivity({
        leadId: lead._id,
        type: 'QUOTATION',
        title: quote.revision > 0 ? `Quotation Revised (Rev ${quote.revision})` : 'Quotation Draft Saved',
        description: `Quotation ${quote.quoteNumber} (Rev ${quote.revision}) saved by ${userName}. Total: ₹${grandTotal.toLocaleString('en-IN')}`,
        user
      });

      await lead.save();

      const io = getIO();
      if (io) {
        io.emit('lead:updated', lead);
      }
    }
  }

  // If quotation is awaiting manager approval, notify Managers and Admins
  if (quote.status === 'Pending Approval' || quote.approvalStatus === 'Pending') {
    try {
      const linkedLead = quote.leadId ? await Lead.findById(quote.leadId).select('name company branchId') : null;
      await notifyManagersAndAdmins({
        branchId: quote.branchId || linkedLead?.branchId,
        title: '📋 Quotation Awaiting Approval',
        message: `Quotation ${quote.quoteNumber} for "${linkedLead?.name || linkedLead?.company || 'Client'}" requires manager approval (submitted by ${user?.name || 'Sales Rep'}).`,
        type: 'quote_approval_needed',
        entityId: quote._id.toString(),
        entityType: 'quotation',
        link: linkedLead ? `/leads/${linkedLead._id}` : `/quotations/${quote._id}`
      });
    } catch (e) {
      console.warn('Pending approval notif error:', e.message);
    }
  }

  const io = getIO();
  if (io) {
    io.emit('quotation:updated', quote);
  }

  return {
    id: quote._id.toString(),
    _id: quote._id.toString(),
    quoteNumber: quote.quoteNumber,
    revision: quote.revision,
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    grandTotal: quote.grandTotal,
    status: quote.status,
    approvalStatus: quote.approvalStatus,
    items: quote.items,
    revisions: quote.revisions || [],
    leadId: quote.leadId ? quote.leadId.toString() : null
  };
};

export const createNewQuotation = async (data, creatorId) => {
  const quoteNumber = await generateQuoteNumber();

  let branchId = data.branchId || null;
  if (!branchId && data.leadId) {
    const linkedLead = await Lead.findById(data.leadId).select('branchId');
    if (linkedLead?.branchId) branchId = linkedLead.branchId;
  }

  let subtotal = 0;
  const items = (data.items || []).map(item => {
    const total = (item.quantity || 1) * (item.unitPrice || 0);
    subtotal += total;
    return { ...item, total };
  });

  const grandTotal = subtotal * 1.18; // approx with 18% GST

  const quote = await Quotation.create({
    quoteNumber,
    revision: 0,
    leadId: data.leadId || null,
    customerId: data.customerId || null,
    branchId,
    createdById: creatorId || null,
    subtotal,
    grandTotal,
    status: data.status || 'Draft',
    approvalStatus: (data.status === 'Draft' || !data.status) ? 'Draft' : (data.approvalStatus || (data.status === 'Approved' ? 'Approved' : 'Pending')),
    items
  });

  return {
    id: quote._id.toString(),
    quoteNumber: quote.quoteNumber,
    grandTotal: quote.grandTotal,
    status: quote.status
  };
};

export const updateQuotationStatus = async (id, { status, reason, leadId = null }, user = null) => {
  let quote = null;

  // 1. Try finding by MongoDB ObjectId if valid
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    quote = await Quotation.findById(id);
  }

  // 2. Try finding by quoteNumber or client custom ID
  if (!quote && id) {
    quote = await Quotation.findOne({
      $or: [
        { quoteNumber: id },
        { quoteNumber: new RegExp(`^${id}$`, 'i') },
        { quoteNumber: new RegExp(id, 'i') }
      ]
    });
  }

  // 3. Try finding by leadId if provided
  const effectiveLeadId = leadId || (id && mongoose.Types.ObjectId.isValid(id) ? id : null);
  if (!quote && effectiveLeadId && mongoose.Types.ObjectId.isValid(effectiveLeadId)) {
    quote = await Quotation.findOne({ leadId: effectiveLeadId });
  }

  // 4. If quotation record does not exist in MongoDB yet, create it for this lead
  if (!quote) {
    let lead = null;
    if (effectiveLeadId && mongoose.Types.ObjectId.isValid(effectiveLeadId)) {
      lead = await Lead.findById(effectiveLeadId);
    }
    if (!lead && id) {
      lead = await Lead.findOne({
        $or: [
          { quotationNumber: id },
          { 'activity.text': new RegExp(id, 'i') }
        ]
      });
    }

    if (lead) {
      const generatedNumber = (typeof id === 'string' && id.startsWith('MEE')) ? id : await generateQuoteNumber();
      quote = await Quotation.create({
        quoteNumber: generatedNumber,
        leadId: lead._id,
        branchId: lead.branchId,
        createdById: lead.assignedToId || user?._id || user?.id,
        status: status || 'Draft',
        subtotal: lead.estimatedValue || 0,
        grandTotal: lead.estimatedValue || 0,
        approvalStatus: status === 'Approved' ? 'Approved' : (status === 'Rejected' ? 'Rejected' : 'Pending')
      });
    }
  }

  if (!quote) {
    if (effectiveLeadId && mongoose.Types.ObjectId.isValid(effectiveLeadId)) {
      const lead = await Lead.findById(effectiveLeadId);
      if (lead) {
        lead.quotationStatus = status;
        if (status === 'Approved') {
          lead.stage = 'Negotiation';
          lead.quotationApprovedAt = new Date();
          lead.quotationApprovedBy = user?.name || 'Sales Manager';
        } else if (status === 'Rejected') {
          lead.quotationRejectedAt = new Date();
          lead.quotationRejectedBy = user?.name || 'Sales Manager';
          lead.quotationRejectionReason = reason || 'Changes requested';
        }
        await lead.save();
        return {
          id: id,
          _id: id,
          status,
          leadId: lead._id.toString()
        };
      }
    }
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  const userName = user?.name || 'Sales Manager';
  const userId = user?._id || user?.id || null;
  const io = getIO();

  if (quote.status === 'Accepted' && status !== 'Accepted') {
    const error = new Error('Quotation is already Won / Accepted and its status cannot be changed.');
    error.statusCode = 400;
    throw error;
  }

  quote.status = status;

  if (status === 'Approved') {
    quote.approvalStatus = 'Approved';
    quote.approvedById = userId;
    quote.approvedBy = userName;
    quote.approvedAt = new Date();
    quote.rejectionReason = '';
  } else if (status === 'Sent') {
    quote.approvalStatus = 'Approved';
    quote.approvedById = userId;
    quote.approvedBy = userName;
    quote.approvedAt = quote.approvedAt || new Date();
    quote.sentAt = new Date();
    quote.sentBy = userName;
    quote.rejectionReason = '';
  } else if (status === 'Rejected') {
    quote.approvalStatus = 'Rejected';
    quote.rejectionReason = reason || 'Changes requested';
    quote.rejectedBy = userName;
    quote.rejectedAt = new Date();
  } else if (status === 'Pending Approval') {
    quote.approvalStatus = 'Pending';
  }

  await quote.save();

  // Synchronize with linked Lead and maintain proper audit trail
  if (quote.leadId) {
    const lead = await Lead.findById(quote.leadId);
    if (lead) {
      lead.quotationStatus = status;
      lead.quotationNumber = quote.quoteNumber;
      lead.quotationId = quote._id;

      if (!Array.isArray(lead.stageHistory)) lead.stageHistory = [];

      if (status === 'Sent') {
        lead.stage = 'Negotiation'; // Automatically advance stage to Negotiation ONLY when sent to client
        lead.quotationSentAt = new Date();
        lead.quotationSentBy = userName;
        lead.quotationRejectionReason = null;

        lead.stageHistory.unshift({
          stage: 'Negotiation',
          by: userName,
          at: new Date()
        });

        await recordActivity({
          leadId: lead._id,
          type: 'QUOTATION',
          title: 'Quotation Sent to Client',
          description: `Quotation ${quote.quoteNumber} sent to client by ${userName}. Lead moved to Negotiation.`,
          user
        });

        if (io) {
          io.emit('lead:stage_changed', { leadId: lead._id.toString(), stage: 'Negotiation', by: userName });
          io.emit('lead:updated', lead);
        }

        // Notify Sales Executive that quotation is sent to client
        try {
          const targetExecutive = quote.createdById || lead.assignedToId;
          if (targetExecutive) {
            await createNotification({
              userId: targetExecutive,
              title: '📤 Quotation Sent to Client',
              message: `Quotation ${quote.quoteNumber} for "${lead.name || lead.company}" has been SENT to client by ${userName}. Deal is now in Negotiation!`,
              type: 'quotation_sent',
              entityId: quote._id.toString(),
              entityType: 'quotation',
              link: `/leads/${lead._id}`
            });
          }
        } catch (e) {
          console.warn('Sent notif error:', e.message);
        }
      } else if (status === 'Approved') {
        // Quotation approved internally; lead remains in Qualified until sent to client
        lead.quotationApprovedAt = lead.quotationApprovedAt || new Date();
        lead.quotationApprovedBy = lead.quotationApprovedBy || userName;
        lead.quotationApprovedById = lead.quotationApprovedById || userId;
        lead.quotationRejectionReason = null;

        await recordActivity({
          leadId: lead._id,
          type: 'QUOTATION',
          title: 'Quotation Approved by Manager',
          description: `Quotation ${quote.quoteNumber} approved by ${userName}. Ready to send to client.`,
          user
        });

        if (io) {
          io.emit('lead:updated', lead);
        }

        // Notify Sales Executive that quotation is approved
        try {
          const targetExecutive = quote.createdById || lead.assignedToId;
          if (targetExecutive) {
            await createNotification({
              userId: targetExecutive,
              title: '✅ Quotation Approved',
              message: `Quotation ${quote.quoteNumber} for "${lead.name || lead.company}" has been APPROVED by ${userName}! You can now send it to the client.`,
              type: 'quotation_approved',
              entityId: quote._id.toString(),
              entityType: 'quotation',
              link: `/leads/${lead._id}`
            });
          }
        } catch (e) {
          console.warn('Approve notif error:', e.message);
        }
      } else if (status === 'Rejected') {
        lead.quotationRejectedAt = new Date();
        lead.quotationRejectedBy = userName;
        lead.quotationRejectionReason = reason || 'Changes requested';

        await recordActivity({
          leadId: lead._id,
          type: 'QUOTATION',
          title: 'Quotation Rejected by Manager',
          description: `Quotation ${quote.quoteNumber} rejected by ${userName}: ${reason || 'Changes requested'}`,
          user
        });

        if (io) {
          io.emit('lead:updated', lead);
        }

        // Notify Sales Executive that quotation is rejected with reason
        try {
          const targetExecutive = quote.createdById || lead.assignedToId;
          if (targetExecutive) {
            await createNotification({
              userId: targetExecutive,
              title: '❌ Quotation Rejected',
              message: `Quotation ${quote.quoteNumber} for "${lead.name || lead.company}" was REJECTED by ${userName}: ${reason || 'Changes requested'}.`,
              type: 'quotation_rejected',
              entityId: quote._id.toString(),
              entityType: 'quotation',
              link: `/leads/${lead._id}`
            });
          }
        } catch (e) {
          console.warn('Reject notif error:', e.message);
        }
      } else if (status === 'Pending Approval') {
        const submitterRole = (user?.roleId?.name || user?.role || '').toLowerCase();
        const isManagerSubmitting = submitterRole.includes('manager');
        const approvalTarget = isManagerSubmitting ? 'Admin' : 'Sales Manager';

        await recordActivity({
          leadId: lead._id,
          type: 'QUOTATION',
          title: 'Quotation Submitted for Approval',
          description: `Quotation ${quote.quoteNumber} submitted for ${approvalTarget} approval by ${userName}.`,
          user
        });

        // Notify Sales Manager (if executive) or Admin (if manager)
        try {
          await notifyManagersAndAdmins({
            branchId: isManagerSubmitting ? null : lead.branchId,
            title: `📋 Quotation Awaiting ${approvalTarget} Approval`,
            message: `Quotation ${quote.quoteNumber} for "${lead.name || lead.company}" submitted for approval by ${userName} (requires ${approvalTarget} sign-off).`,
            type: 'quotation_awaiting_approval',
            entityId: quote._id.toString(),
            entityType: 'quotation',
            link: `/leads/${lead._id}`
          });
        } catch (e) {
          console.warn('Pending approval notif error:', e.message);
        }
      } else if (status === 'Accepted') {
        lead.stage = 'Won';
        lead.status = 'Converted';
        lead.stageHistory.unshift({ stage: 'Won', by: userName, at: new Date() });

        // Ensure customer exists and is linked
        if (!lead.customerId) {
          try {
            const compName = (lead.company || lead.name || '').trim();
            let targetBranchId = lead.branchId;
            if (!targetBranchId && lead.assignedToId) {
              const aUser = await User.findById(lead.assignedToId).select('branchId').lean();
              if (aUser?.branchId) targetBranchId = aUser.branchId;
            }
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
              ownerId: lead.assignedToId || null,
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
            try { emitCustomerCreated(newCust); } catch (e) {}
          } catch (err) {
            console.warn('Auto create customer on quote accept error:', err.message);
          }
        }

        // Ensure customer has the accepted quotation products
        if (lead.customerId) {
          try {
            const custDoc = await Customer.findById(lead.customerId);
            if (custDoc) {
              custDoc.source = 'Won deal';
              if (!custDoc.branchId && lead.branchId) {
                custDoc.branchId = lead.branchId;
              }
              if (!Array.isArray(custDoc.products)) custDoc.products = [];
              const existingKeys = new Set(custDoc.products.map(p => `${p.quoteNumber || ''}_${p.name}`));
              (quote.items || []).forEach(it => {
                const desc = it.description || 'Genset Equipment';
                const key = `${quote.quoteNumber || ''}_${desc}`;
                if (!existingKeys.has(key)) {
                  existingKeys.add(key);
                  const kvaMatch = desc.match(/(\d+(\.\d+)?\s*kVA)/i);
                  custDoc.products.push({
                    name: desc,
                    kva: it.kva || (kvaMatch ? kvaMatch[1] : ''),
                    model: desc,
                    qty: it.quantity || 1,
                    rate: it.total || it.unitPrice || 0,
                    purchaseDate: new Date(),
                    status: 'Under Warranty',
                    quoteNumber: quote.quoteNumber || '',
                    notes: `From Quotation ${quote.quoteNumber || ''}`
                  });
                }
              });
              await custDoc.save();
              try { emitCustomerUpdated(custDoc); } catch (e) {}
            }
          } catch (err) {
            console.warn('Sync quote to customer error:', err.message);
          }
        }

        await recordActivity({
          leadId: lead._id,
          type: 'QUOTATION',
          title: 'Quotation Accepted - Deal Won',
          description: `Quotation ${quote.quoteNumber} accepted by client! Deal Won by ${userName}.`,
          user
        });

        if (io) {
          io.emit('lead:stage_changed', { leadId: lead._id.toString(), stage: 'Won', by: userName });
          io.emit('lead:updated', lead);
        }

        // Notify Sales Manager and Admins that quotation accepted / deal won
        try {
          await notifyManagersAndAdmins({
            branchId: lead.branchId,
            title: '🎉 Deal Closed - WON!',
            message: `Quotation ${quote.quoteNumber} for "${lead.name || lead.company}" accepted by client! Deal WON by ${userName}.`,
            type: 'deal_won',
            entityId: lead._id.toString(),
            entityType: 'lead',
            link: `/leads/${lead._id}`
          });
        } catch (e) {
          console.warn('Won notif error:', e.message);
        }
      } else {
        await recordActivity({
          leadId: lead._id,
          type: 'QUOTATION',
          title: `Quotation Status: ${status}`,
          description: `Quotation ${quote.quoteNumber} status set to '${status}' by ${userName}.`,
          user
        });
      }

      await lead.save();
    }
  }

  if (io) {
    io.emit('quotation:status_changed', {
      quote,
      action: status.toLowerCase(),
      by: userName,
      reason,
      leadId: quote.leadId ? quote.leadId.toString() : null
    });
    io.emit('quotation:updated', quote);

    if (status === 'Accepted' && quote.leadId) {
      io.emit('lead:stage_changed', {
        id: quote.leadId.toString(),
        leadId: quote.leadId.toString(),
        stage: 'Won',
        status: 'Converted',
        by: userName
      });
      io.emit('lead:updated', { _id: quote.leadId, id: quote.leadId.toString(), stage: 'Won', status: 'Converted' });
    }
  }

  return {
    id: quote._id.toString(),
    _id: quote._id.toString(),
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    approvalStatus: quote.approvalStatus,
    approvedBy: quote.approvedBy,
    approvedAt: quote.approvedAt,
    rejectionReason: quote.rejectionReason,
    createdById: quote.createdById ? quote.createdById.toString() : null,
    leadId: quote.leadId ? quote.leadId.toString() : null
  };
};

export const changeQuotationStatus = async (id, status, reason, user = null, leadId = null) => {
  return await updateQuotationStatus(id, { status, reason, leadId }, user);
};

export const removeQuotation = async (id) => {
  const quote = await Quotation.findByIdAndDelete(id);
  if (!quote) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }
  return { id, message: 'Quotation deleted successfully' };
};
