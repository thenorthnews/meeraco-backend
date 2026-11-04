import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  code: { type: String, unique: true, sparse: true },
  kind: { type: String, default: 'Genset' },
  name: { type: String, required: true },
  kva: { type: Number, default: null },
  engineMake: { type: String, default: 'Cummins' },
  alternatorMake: { type: String, default: 'Stamford' },
  fuel: { type: String, default: 'Diesel' },
  basePrice: { type: Number, default: 0 },
  gstPct: { type: Number, default: 18 },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
export { Product };
