import mongoose from 'mongoose';

const rolePermissionSchema = new mongoose.Schema({
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: [true, 'RoleId is required']
  },
  module: {
    type: String,
    required: [true, 'Module name is required'],
    trim: true
  },
  canView: {
    type: Boolean,
    default: false
  },
  canCreate: {
    type: Boolean,
    default: false
  },
  canEdit: {
    type: Boolean,
    default: false
  },
  canDelete: {
    type: Boolean,
    default: false
  },
  canExport: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure a single permission record per role per module
rolePermissionSchema.index({ roleId: 1, module: 1 }, { unique: true });

const RolePermission = mongoose.models.RolePermission || mongoose.model('RolePermission', rolePermissionSchema);

export default RolePermission;
export { RolePermission };
