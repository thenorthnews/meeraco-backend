import mongoose from 'mongoose';

const quotationSchema = new mongoose.Schema({
  quoteNumber: { type: String, required: true },
  revision: { type: Number, default: 0 },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  subtotal: { type: Number, default: 0 },
  discountTotal: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  status: { type: String, default: 'Draft' },
  items: [{
    description: String,
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    gstPct: { type: Number, default: 18 },
    total: { type: Number, default: 0 }
  }]
}, {
  timestamps: true
});

const Quotation = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);

export default Quotation;
export { Quotation };
