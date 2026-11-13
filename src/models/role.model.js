import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  scope: {
    type: String,
    enum: ['all', 'districts', 'own'],
    default: 'own'
  },
  isSystem: {
    type: Boolean,
    default: false // true for system root roles
  },
  permissionsList: {
    type: [String],
    default: []
  },
  simplifiedPermissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

export default Role;
export { Role };
