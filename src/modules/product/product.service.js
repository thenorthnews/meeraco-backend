import { Product } from '../../models/index.js';

export const fetchProducts = async ({ kind, active, search, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (kind) query.kind = kind;
  if (typeof active !== 'undefined') query.active = active === 'true' || active === true;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query).sort({ kva: 1 }).skip(skip).limit(limitNum).lean()
  ]);

  return {
    products: products.map(p => ({
      id: p._id.toString(),
      code: p.code,
      kind: p.kind,
      name: p.name,
      kva: p.kva,
      engineMake: p.engineMake,
      alternatorMake: p.alternatorMake,
      fuel: p.fuel,
      basePrice: p.basePrice,
      gstPct: p.gstPct,
      active: p.active
    })),
    total,
    pageNum,
    limitNum
  };
};

export const createNewProduct = async (data) => {
  const { code, kind, name, kva, engineMake, alternatorMake, fuel, phase, specs, basePrice, gstPct } = data;

  if (code) {
    const existing = await Product.findOne({ code: code.toUpperCase() });
    if (existing) {
      const error = new Error(`Product with code '${code}' already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  const product = await Product.create({
    code: code ? code.toUpperCase() : undefined,
    kind: kind || 'Genset',
    name,
    kva,
    engineMake,
    alternatorMake,
    fuel,
    phase,
    specs,
    basePrice: basePrice || 0,
    gstPct: typeof gstPct !== 'undefined' ? gstPct : 18,
    active: true
  });

  return {
    id: product._id.toString(),
    code: product.code,
    kind: product.kind,
    name: product.name,
    kva: product.kva,
    basePrice: product.basePrice,
    gstPct: product.gstPct
  };
};
