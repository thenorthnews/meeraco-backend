import mongoose from 'mongoose';
import { Product } from '../../models/index.js';

const INITIAL_CATALOGUE = [
  { kind: 'Genset', name: 'MG 125 Industrial', kva: 125, engineMake: 'Cummins', alternatorMake: 'Stamford', fuel: 'Diesel', phase: 'Three', specs: 'CPCB IV+ compliant soundproof canopy', price: 685000, basePrice: 685000, gstPct: 18, active: true },
  { kind: 'Genset', name: 'MG 250 Industrial', kva: 250, engineMake: 'Cummins', alternatorMake: 'Stamford', fuel: 'Diesel', phase: 'Three', specs: 'CPCB IV+ compliant soundproof canopy', price: 1140000, basePrice: 1140000, gstPct: 18, active: true },
  { kind: 'Genset', name: 'MG 500 Prime', kva: 500, engineMake: 'Cummins', alternatorMake: 'Stamford', fuel: 'Diesel', phase: 'Three', specs: 'Continuous heavy duty prime power', price: 2320000, basePrice: 2320000, gstPct: 18, active: true },
  { kind: 'Accessory', name: 'Automatic Transfer Switch (AMF)', kva: null, engineMake: '', alternatorMake: '', fuel: '', phase: 'Three', specs: 'Auto mains failure panel with digital controller', price: 42000, basePrice: 42000, gstPct: 18, active: true },
  { kind: 'Accessory', name: 'External Fuel Tank 500L', kva: null, engineMake: '', alternatorMake: '', fuel: 'Diesel', phase: '', specs: 'Mild steel with fuel level gauge', price: 28000, basePrice: 28000, gstPct: 18, active: true },
  { kind: 'Service charge', name: 'Standard Installation & Testing', kva: null, engineMake: '', alternatorMake: '', fuel: '', phase: '', specs: 'Civil foundation inspection, cabling, testing & commissioning', price: 18500, basePrice: 18500, gstPct: 18, active: true },
  { kind: 'Service charge', name: 'Comprehensive AMC (1 Year)', kva: null, engineMake: '', alternatorMake: '', fuel: '', phase: '', specs: 'Quarterly servicing + breakdown maintenance', price: 35000, basePrice: 35000, gstPct: 18, active: true }
];

export const fetchProducts = async ({ kind, active, search, page = 1, limit = 10, sort = 'kva', dir = 1 } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  const skip = (pageNum - 1) * limitNum;

  // Auto seed default products if empty
  const count = await Product.countDocuments();
  if (count === 0) {
    try {
      await Product.insertMany(INITIAL_CATALOGUE);
    } catch (e) {
      console.warn('Initial product seed note:', e.message);
    }
  }

  // Dynamic MongoDB query conditions
  const conditions = [];

  if (kind && kind !== 'all') {
    conditions.push({ kind });
  }

  if (typeof active !== 'undefined' && active !== '' && active !== 'all' && active !== null) {
    const isActive = String(active).toLowerCase() === 'true' || active === true;
    if (isActive) {
      conditions.push({
        $or: [{ active: true }, { active: 'true' }, { active: { $exists: false } }, { active: null }]
      });
    } else {
      conditions.push({
        $or: [{ active: false }, { active: 'false' }]
      });
    }
  }

  const searchTerm = (search || '').trim();
  if (searchTerm) {
    conditions.push({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { code: { $regex: searchTerm, $options: 'i' } },
        { engineMake: { $regex: searchTerm, $options: 'i' } },
        { alternatorMake: { $regex: searchTerm, $options: 'i' } },
        { specs: { $regex: searchTerm, $options: 'i' } }
      ]
    });
  }

  const query = conditions.length > 0 ? { $and: conditions } : {};

  // Dynamic sort
  const sortObj = {};
  if (sort === 'price' || sort === 'basePrice') {
    sortObj.basePrice = Number(dir) || 1;
  } else if (sort === 'name') {
    sortObj.name = Number(dir) || 1;
  } else {
    sortObj.kva = Number(dir) || 1;
    sortObj.name = 1;
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query).sort(sortObj).skip(skip).limit(limitNum).lean()
  ]);

  return {
    products: products.map(p => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      code: p.code || '',
      kind: p.kind || 'Genset',
      name: p.name,
      kva: p.kva,
      engineMake: p.engineMake || '',
      alternatorMake: p.alternatorMake || '',
      fuel: p.fuel || 'Diesel',
      phase: p.phase || 'Three',
      specs: p.specs || '',
      price: typeof p.price === 'number' && p.price > 0 ? p.price : (p.basePrice || 0),
      basePrice: p.basePrice || p.price || 0,
      gstPct: typeof p.gstPct === 'number' ? p.gstPct : 18,
      active: p.active !== false
    })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1
  };
};

export const fetchProductById = async (id) => {
  let product = null;
  if (mongoose.isValidObjectId(id)) {
    product = await Product.findById(id).lean();
  }
  if (!product) {
    product = await Product.findOne({ code: String(id).toUpperCase() }).lean();
  }
  if (!product) {
    const error = new Error('Product not found in catalogue');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: product._id.toString(),
    _id: product._id.toString(),
    code: product.code || '',
    kind: product.kind,
    name: product.name,
    kva: product.kva,
    engineMake: product.engineMake || '',
    alternatorMake: product.alternatorMake || '',
    fuel: product.fuel || 'Diesel',
    phase: product.phase || 'Three',
    specs: product.specs || '',
    price: product.price || product.basePrice || 0,
    basePrice: product.basePrice || product.price || 0,
    gstPct: product.gstPct || 18,
    active: product.active !== false
  };
};

export const createNewProduct = async (data) => {
  const { code, kind, name, kva, engineMake, alternatorMake, fuel, phase, specs, price, basePrice, gstPct, active } = data;

  let cleanCode = code ? code.trim().toUpperCase() : '';
  if (!cleanCode) {
    const prefix = (kind === 'Genset' ? 'GEN' : kind === 'Accessory' ? 'ACC' : 'SRV');
    cleanCode = `${prefix}-${Date.now().toString().slice(-6)}`;
  } else {
    const existing = await Product.findOne({ code: cleanCode });
    if (existing) {
      const error = new Error(`Product with code '${cleanCode}' already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  const finalPrice = Number(price ?? basePrice ?? 0);

  const product = await Product.create({
    code: cleanCode,
    kind: kind || 'Genset',
    name: name.trim(),
    kva: kva ? Number(kva) : null,
    engineMake: engineMake || '',
    alternatorMake: alternatorMake || '',
    fuel: fuel || 'Diesel',
    phase: phase || 'Three',
    specs: specs || '',
    price: finalPrice,
    basePrice: finalPrice,
    gstPct: typeof gstPct !== 'undefined' ? Number(gstPct) : 18,
    active: active !== false
  });

  return {
    id: product._id.toString(),
    _id: product._id.toString(),
    code: product.code,
    kind: product.kind,
    name: product.name,
    kva: product.kva,
    engineMake: product.engineMake,
    alternatorMake: product.alternatorMake,
    fuel: product.fuel,
    phase: product.phase,
    specs: product.specs,
    price: product.price,
    basePrice: product.basePrice,
    gstPct: product.gstPct,
    active: product.active
  };
};

export const updateExistingProduct = async (id, data) => {
  let existing = null;
  if (mongoose.isValidObjectId(id)) {
    existing = await Product.findById(id);
  }
  if (!existing) {
    existing = await Product.findOne({ code: String(id).toUpperCase() });
  }
  if (!existing) {
    const error = new Error('Product not found in catalogue');
    error.statusCode = 404;
    throw error;
  }

  const update = {};
  if (data.name) update.name = data.name.trim();
  if (data.kind) update.kind = data.kind;
  if (data.code) {
    const cleanCode = data.code.trim().toUpperCase();
    const dup = await Product.findOne({ code: cleanCode, _id: { $ne: existing._id } });
    if (dup) {
      const error = new Error(`Product code '${cleanCode}' is already taken`);
      error.statusCode = 400;
      throw error;
    }
    update.code = cleanCode;
  }
  if (typeof data.kva !== 'undefined') update.kva = data.kva ? Number(data.kva) : null;
  if (typeof data.engineMake !== 'undefined') update.engineMake = data.engineMake;
  if (typeof data.alternatorMake !== 'undefined') update.alternatorMake = data.alternatorMake;
  if (typeof data.fuel !== 'undefined') update.fuel = data.fuel;
  if (typeof data.phase !== 'undefined') update.phase = data.phase;
  if (typeof data.specs !== 'undefined') update.specs = data.specs;
  if (typeof data.price !== 'undefined' || typeof data.basePrice !== 'undefined') {
    const p = Number(data.price ?? data.basePrice ?? 0);
    update.price = p;
    update.basePrice = p;
  }
  if (typeof data.gstPct !== 'undefined') update.gstPct = Number(data.gstPct);
  if (typeof data.active !== 'undefined') update.active = Boolean(data.active);

  const updated = await Product.findByIdAndUpdate(existing._id, { $set: update }, { new: true }).lean();

  return {
    id: updated._id.toString(),
    _id: updated._id.toString(),
    code: updated.code || '',
    kind: updated.kind,
    name: updated.name,
    kva: updated.kva,
    engineMake: updated.engineMake,
    alternatorMake: updated.alternatorMake,
    fuel: updated.fuel,
    phase: updated.phase,
    specs: updated.specs,
    price: updated.price || updated.basePrice || 0,
    basePrice: updated.basePrice || updated.price || 0,
    gstPct: updated.gstPct,
    active: updated.active !== false
  };
};

export const changeProductStatus = async (id, active) => {
  let existing = null;
  if (mongoose.isValidObjectId(id)) {
    existing = await Product.findById(id);
  }
  if (!existing) {
    existing = await Product.findOne({ code: String(id).toUpperCase() });
  }
  if (!existing) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await Product.findByIdAndUpdate(
    existing._id,
    { $set: { active: Boolean(active) } },
    { new: true }
  ).lean();

  return {
    id: updated._id.toString(),
    active: updated.active
  };
};

export const removeProduct = async (id) => {
  let existing = null;
  if (mongoose.isValidObjectId(id)) {
    existing = await Product.findById(id);
  }
  if (!existing) {
    existing = await Product.findOne({ code: String(id).toUpperCase() });
  }
  if (!existing) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  await Product.findByIdAndDelete(existing._id);
  return {
    id: existing._id.toString(),
    name: existing.name
  };
};

export const bulkCreateProducts = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('No items provided for import');
    error.statusCode = 400;
    throw error;
  }

  const ops = items.map((item, idx) => {
    const finalPrice = Number(item.price ?? item.basePrice ?? 0);
    return {
      name: item.name ? item.name.trim() : `Imported Item ${idx + 1}`,
      code: item.code ? item.code.trim().toUpperCase() : `PRD-IMP-${Date.now().toString().slice(-4)}-${idx}`,
      kind: item.kind || 'Genset',
      kva: item.kva ? Number(item.kva) : null,
      engineMake: item.engineMake || '',
      alternatorMake: item.alternatorMake || '',
      fuel: item.fuel || 'Diesel',
      phase: item.phase || 'Three',
      specs: item.specs || '',
      price: finalPrice,
      basePrice: finalPrice,
      gstPct: typeof item.gstPct !== 'undefined' ? Number(item.gstPct) : 18,
      active: item.active !== false
    };
  });

  const inserted = await Product.insertMany(ops, { ordered: false });
  return {
    importedCount: inserted.length
  };
};
