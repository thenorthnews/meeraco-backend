import mongoose from 'mongoose';

const assignmentRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  state: {
    type: String,
    default: null
  },
  district: {
    type: String,
    default: null
  },
  source: {
    type: String,
    default: null
  },
  assignType: {
    type: String,
    enum: ['user', 'group'],
    default: 'group'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  group: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  order: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const AssignmentRule = mongoose.models.AssignmentRule || mongoose.model('AssignmentRule', assignmentRuleSchema);

export default AssignmentRule;
export { AssignmentRule };

