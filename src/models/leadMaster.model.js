import mongoose from 'mongoose';

const leadMasterSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['stages', 'sources', 'priorities', 'lossReasons', 'stage', 'source', 'priority', 'lossReason'],
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: 'grey'
  },
  order: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

leadMasterSchema.index({ type: 1, name: 1 }, { unique: true });

const LeadMaster = mongoose.models.LeadMaster || mongoose.model('LeadMaster', leadMasterSchema);

export default LeadMaster;
export { LeadMaster };

