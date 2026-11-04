import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customerNumber: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  billingAddress: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  segment: { type: String, default: 'Industrial' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }
}, {
  timestamps: true
});

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;
export { Customer };
