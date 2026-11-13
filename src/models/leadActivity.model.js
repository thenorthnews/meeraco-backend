import mongoose from 'mongoose';

const leadActivitySchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['CREATED', 'EDITED', 'STAGE_CHANGE', 'REASSIGNED', 'NOTE_ADDED', 'FOLLOW_UP', 'STATUS_CHANGE', 'QUOTATION'],
    default: 'EDITED'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  performedBy: {
    type: String,
    default: 'System'
  },
  performedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    set: v => (v && /^[0-9a-fA-F]{24}$/.test(String(v?._id || v?.id || v))) ? v : null
  }
}, {
  timestamps: true
});

leadActivitySchema.index({ leadId: 1, createdAt: -1 });

const LeadActivity = mongoose.models.LeadActivity || mongoose.model('LeadActivity', leadActivitySchema);

export default LeadActivity;
export { LeadActivity };

