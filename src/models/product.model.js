import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  code: { type: String, unique: true, sparse: true, trim: true },
  kind: {
    type: String,
    enum: ['Genset', 'Accessory', 'Service charge', 'Service', 'SparePart'],
    default: 'Genset',
    trim: true
  },
  name: { type: String, required: true, trim: true },
  kva: { type: Number, default: null },
  engineMake: { type: String, default: 'Cummins', trim: true },
  alternatorMake: { type: String, default: 'Stamford', trim: true },
  fuel: { type: String, default: 'Diesel', trim: true },
  phase: { type: String, default: 'Three', trim: true },
  specs: { type: String, default: '', trim: true },
  price: { type: Number, default: 0 },
  basePrice: { type: Number, default: 0 },
  gstPct: { type: Number, default: 18 },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Sync price and basePrice automatically before saving
productSchema.pre('save', function (next) {
  if (this.price && !this.basePrice) {
    this.basePrice = this.price;
  } else if (this.basePrice && !this.price) {
    this.price = this.basePrice;
  }
  next();
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
export { Product };
