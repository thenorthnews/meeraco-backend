import { Quotation } from '../../models/index.js';

export const generateQuoteNumber = async () => {
  const count = await Quotation.countDocuments();
  return `MEE-Q-${String(count + 1).padStart(5, '0')}`;
};

export const fetchQuotations = async ({ status, branchId, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status;
  if (branchId) query.branchId = branchId;

  const [total, quotes] = await Promise.all([
    Quotation.countDocuments(query),
    Quotation.find(query)
      .populate('leadId', 'leadNumber title company')
      .populate('customerId', 'customerNumber companyName')
      .populate('branchId', 'name code')
      .populate('createdById', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
  ]);

  return {
    quotations: quotes.map(q => ({
      id: q._id.toString(),
      quoteNumber: q.quoteNumber,
      revision: q.revision,
      status: q.status,
      grandTotal: q.grandTotal,
      company: q.customerId?.companyName || q.leadId?.company || '—',
      createdAt: q.createdAt
    })),
    total,
    pageNum,
    limitNum
  };
};

export const fetchQuotationById = async (id) => {
  const quote = await Quotation.findById(id)
    .populate('leadId')
    .populate('customerId')
    .populate('branchId')
    .populate('createdById', 'name email')
    .lean();

  if (!quote) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: quote._id.toString(),
    ...quote
  };
};

export const createNewQuotation = async (data, creatorId) => {
  const quoteNumber = await generateQuoteNumber();

  let subtotal = 0;
  const items = (data.items || []).map(item => {
    const total = (item.quantity || 1) * (item.unitPrice || 0);
    subtotal += total;
    return { ...item, total };
  });

  const grandTotal = subtotal * 1.18; // approx with 18% GST

  const quote = await Quotation.create({
    quoteNumber,
    revision: 0,
    leadId: data.leadId || null,
    customerId: data.customerId || null,
    branchId: data.branchId || null,
    createdById: creatorId || null,
    subtotal,
    grandTotal,
    status: 'Draft',
    items
  });

  return {
    id: quote._id.toString(),
    quoteNumber: quote.quoteNumber,
    grandTotal: quote.grandTotal,
    status: quote.status
  };
};

export const updateQuotationStatus = async (id, { status, reason }) => {
  const quote = await Quotation.findByIdAndUpdate(
    id,
    { $set: { status, rejectedReason: reason || null } },
    { new: true }
  );

  if (!quote) {
    const error = new Error('Quotation not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: quote._id.toString(),
    status: quote.status
  };
};
