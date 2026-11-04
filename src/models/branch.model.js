import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  gstin: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  managerId: { type: String, default: null },
  territories: {
    type: [
      {
        state: String,
        districts: [String]
      }
    ],
    default: []
  },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

const Branch = mongoose.models.Branch || mongoose.model('Branch', branchSchema);

export default Branch;
export { Branch };
