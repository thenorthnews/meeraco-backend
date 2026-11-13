import mongoose from 'mongoose';

const contactSubSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  designation: { type: String, default: '' },
  mobile: { type: String, default: '' },
  email: { type: String, default: '' },
  primary: { type: Boolean, default: false }
}, { _id: true, id: true });

const productSubSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  kva: { type: String, default: '' },
  model: { type: String, default: '' },
  serialNumber: { type: String, default: '' },
  qty: { type: Number, default: 1 },
  rate: { type: Number, default: 0 },
  purchaseDate: { type: Date, default: Date.now },
  warrantyExpiry: { type: Date, default: null },
  status: { type: String, default: 'Delivered' },
  quoteNumber: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { _id: true, id: true });

const customerSchema = new mongoose.Schema({
  customerNumber: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  companyName: { type: String, required: true },
  type: { type: String, default: 'Business' },
  industry: { type: String, default: '' },
  segment: { type: String, default: 'Industrial' },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  billingAddress: { type: String, default: '' },
  siteAddresses: { type: [String], default: [] },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  active: { type: Boolean, default: true },
  contacts: { type: [contactSubSchema], default: [] },
  products: { type: [productSubSchema], default: [] }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;
export { Customer };
