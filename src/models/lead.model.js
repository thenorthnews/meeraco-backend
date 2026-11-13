import mongoose from 'mongoose';

const sanitizeObjectId = v => (v && /^[0-9a-fA-F]{24}$/.test(String(v?._id || v?.id || v))) ? v : null;

const leadActivitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['CREATED', 'EDITED', 'STAGE_CHANGE', 'REASSIGNED', 'NOTE_ADDED', 'FOLLOW_UP', 'STATUS_CHANGE', 'QUOTATION'],
    default: 'EDITED'
  },
  text: { type: String, required: true },
  by: { type: String, default: 'System' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, set: sanitizeObjectId },
  at: { type: Date, default: Date.now }
}, { _id: true });

const leadNoteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  by: { type: String, default: 'System' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, set: sanitizeObjectId },
  at: { type: Date, default: Date.now }
}, { _id: true });

const stageHistorySchema = new mongoose.Schema({
  stage: { type: String, required: true },
  by: { type: String, default: 'System' },
  at: { type: Date, default: Date.now }
}, { _id: false });

const leadSchema = new mongoose.Schema({
  leadNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true }, // Contact person name
  company: { type: String, default: '' },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  district: { type: String, default: '' },
  pincode: { type: String, default: '' },
  siteLocation: { type: String, default: '' },

  source: { type: String, default: 'Direct' },
  priority: { type: String, enum: ['Hot', 'Warm', 'Cold'], default: 'Warm' },
  stage: { type: String, default: 'New' },
  status: { type: String, enum: ['Open', 'Active', 'Inactive', 'Converted', 'Closed'], default: 'Active' },
  active: { type: Boolean, default: true },
  lossReason: { type: String, default: null },

  kva: { type: Number, default: null },
  quantity: { type: Number, default: 1 },
  estimatedValue: { type: Number, default: 0 },
  expectedClose: { type: Date, default: null },

  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, set: sanitizeObjectId },
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, set: sanitizeObjectId }, // Assigned To
  assignedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, set: sanitizeObjectId }, // Assigned By
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, set: sanitizeObjectId },  // Creator
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, set: sanitizeObjectId }, // Linked customer when won

  notes: [leadNoteSchema],
  stageHistory: [stageHistorySchema],
  activity: [leadActivitySchema]
}, {
  timestamps: true
});

leadSchema.index({ name: 'text', company: 'text', phone: 'text', email: 'text', leadNumber: 'text' });
leadSchema.index({ stage: 1, branchId: 1, assignedToId: 1, createdAt: -1 });

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);

export default Lead;
export { Lead };
