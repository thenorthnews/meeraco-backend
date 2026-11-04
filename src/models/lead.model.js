import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  leadNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  contactName: { type: String, default: '' },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  district: { type: String, default: '' },
  source: { type: String, default: 'Direct' },
  segment: { type: String, default: 'Industrial' },
  stage: { type: String, default: 'New' },
  status: { type: String, default: 'Open' },
  kva: { type: Number, default: null },
  estimatedValue: { type: Number, default: 0 },
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }
}, {
  timestamps: true
});

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema);

export default Lead;
export { Lead };
