import { ok, created, badRequest, notFound, forbidden, serverError, paginated } from '../../helpers/response.helper.js';
import * as leadService from './lead.service.js';
import { createLeadSchema, updateLeadSchema, updateLeadStageSchema, reassignLeadSchema } from './lead.validation.js';
import { idParamSchema } from '../../validations/common.validation.js';
import { emitLeadCreated, emitLeadUpdated } from '../../socket/socket.js';
import { createNotification, notifyManagersAndAdmins } from '../notification/notification.service.js';

export const getLeads = async (req, res) => {
  try {
    const { stage, source, priority, branchId, date, search, page = 1, limit = 20 } = req.query;
    const result = await leadService.fetchLeads({
      stage,
      source,
      priority,
      branchId,
      date,
      search,
      page,
      limit,
      user: req.user
    });

    return paginated(res, {
      items: result.leads,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      message: 'Leads fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch leads', error);
  }
};

export const getLeadById = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const lead = await leadService.fetchLeadById(req.params.id, req.user);
    return ok(res, 'Lead details fetched successfully', lead);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    if (error.statusCode === 403) return forbidden(res, error.message);
    return serverError(res, 'Failed to fetch lead', error);
  }
};

export const getLeadActivities = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { page = 1, limit = 5, filter, type } = req.query;

    const result = await leadService.fetchLeadActivities(req.params.id, {
      page: Number(page) || 1,
      limit: Number(limit) || 5,
      filter: filter || type
    });

    return paginated(res, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      message: 'Lead activities fetched successfully'
    });
  } catch (error) {
    return serverError(res, 'Failed to fetch lead activities', error);
  }
};

export const createLead = async (req, res) => {
  try {
    const { error, value } = createLeadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const lead = await leadService.createNewLead(value, req.user);
    emitLeadCreated(lead);

    // Notify assigned salesperson immediately
    const targetAssigneeId = lead.assignedToId || value.assignedToId || value.assignedTo;
    if (targetAssigneeId) {
      try {
        const rawAssignedId = targetAssigneeId?._id || targetAssigneeId;
        await createNotification({
          userId: rawAssignedId,
          title: 'New Lead Assigned',
          message: `New lead "${lead.name || value.name || 'New Lead'}" (${lead.kva || value.kva ? `${lead.kva || value.kva} kVA × ${lead.quantity || value.quantity || 1}` : 'Genset'}) has been assigned to you by ${req.user.name}.`,
          type: 'lead_assigned',
          entityId: (lead._id || lead.id).toString(),
          entityType: 'lead',
          link: `/leads/${lead._id || lead.id}`
        });
        console.log(`📢 [Notification] Lead assignment notification created for user: ${rawAssignedId}`);
      } catch (notifErr) {
        console.warn('Lead assigned notification note:', notifErr.message);
      }
    }

    return created(res, 'Lead created successfully', lead);
  } catch (error) {
    console.log("🚀 ~ createLead ~ error:", error)
    if (error.statusCode === 400) return badRequest(res, error.message);
    return serverError(res, 'Failed to create lead', error);
  }
};

export const updateLead = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error, value } = updateLeadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return badRequest(res, error.details.map(d => d.message).join(', '));
    }

    const updated = await leadService.updateLeadDetails(req.params.id, value, req.user);
    emitLeadUpdated(updated);
    return ok(res, 'Lead updated successfully', updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update lead', error);
  }
};

export const updateLeadStage = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = updateLeadStageSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await leadService.updateStage(req.params.id, value, req.user);
    emitLeadUpdated(updated);

    // Trigger in-app & device notifications
    try {
      const leadName = updated.contactName || updated.company || 'Lead Deal';
      if (value.stage === 'Qualified') {
        await notifyManagersAndAdmins({
          branchId: updated.branchId,
          title: '📋 Quotation Awaiting Approval',
          message: `${leadName} was Qualified by ${req.user.name}. Quotation awaits sign-off.`,
          type: 'quote_approval_needed',
          entityId: updated._id.toString(),
          entityType: 'lead',
          link: `/leads/${updated._id}`
        });
      } else if (value.stage === 'Negotiation' && updated.assignedToId) {
        await createNotification({
          userId: updated.assignedToId,
          title: '✅ Quotation Approved',
          message: `Quotation for ${leadName} has been APPROVED by ${req.user.name}! Ready to send to customer.`,
          type: 'quote_approved',
          entityId: updated._id.toString(),
          entityType: 'lead',
          link: `/leads/${updated._id}`
        });
      } else if (value.stage === 'Won') {
        await notifyManagersAndAdmins({
          branchId: updated.branchId,
          title: '🎉 Deal Closed - WON!',
          message: `Deal for "${leadName}" (${updated.estimatedValue ? `₹${Number(updated.estimatedValue).toLocaleString('en-IN')}` : ''}) has been successfully WON by ${req.user.name}!`,
          type: 'deal_won',
          entityId: updated._id.toString(),
          entityType: 'lead',
          link: `/leads/${updated._id}`
        });
      } else if (value.stage === 'Lost' && updated.assignedToId) {
        await createNotification({
          userId: updated.assignedToId,
          title: '❌ Deal Marked as Lost',
          message: `Deal '${leadName}' was closed as: ${value.lossReason || 'Lost'}.`,
          type: 'quote_rejected',
          entityId: updated._id.toString(),
          entityType: 'lead',
          link: `/leads/${updated._id}`
        });
      }
    } catch (notifErr) {
      console.warn('Notification trigger note:', notifErr.message);
    }

    return ok(res, `Lead stage updated to '${value.stage}'`, updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to update lead stage', error);
  }
};

export const reassignLead = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const { error: bodyErr, value } = reassignLeadSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (bodyErr) {
      return badRequest(res, bodyErr.details.map(d => d.message).join(', '));
    }

    const updated = await leadService.reassign(req.params.id, value, req.user);
    emitLeadUpdated(updated);

    try {
      if (updated.assignedToId) {
        await createNotification({
          userId: updated.assignedToId,
          title: '👤 New Lead Assigned',
          message: `Lead '${updated.contactName || updated.company || 'New Lead'}' has been assigned to you.`,
          type: 'lead_assigned',
          entityId: updated._id.toString(),
          entityType: 'lead',
          link: `/leads/${updated._id}`
        });
      }
    } catch (_) {}

    return ok(res, 'Lead reassigned successfully', updated);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    if (error.statusCode === 400) return badRequest(res, error.message);
    return serverError(res, 'Failed to reassign lead', error);
  }
};

export const deleteLead = async (req, res) => {
  try {
    const { error: paramErr } = idParamSchema.validate(req.params, { abortEarly: false });
    if (paramErr) {
      return badRequest(res, paramErr.details.map(d => d.message).join(', '));
    }

    const result = await leadService.deleteLead(req.params.id, req.user);
    return ok(res, 'Lead deleted successfully', result);
  } catch (error) {
    if (error.statusCode === 404) return notFound(res, error.message);
    return serverError(res, 'Failed to delete lead', error);
  }
};
