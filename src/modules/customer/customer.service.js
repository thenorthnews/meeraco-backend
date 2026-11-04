import { Customer } from '../../models/index.js';

export const fetchCustomers = async ({ branchId, search, page = 1, limit = 50 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 50);
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (branchId) query.branchId = branchId;
  if (search) {
    query.$or = [
      { companyName: { $regex: search, $options: 'i' } },
      { customerNumber: { $regex: search, $options: 'i' } },
      { gstin: { $regex: search, $options: 'i' } }
    ];
  }

  const [total, customers] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query).populate('branchId', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean()
  ]);

  return {
    customers: customers.map(c => ({
      id: c._id.toString(),
      customerNumber: c.customerNumber,
      companyName: c.companyName,
      gstin: c.gstin,
      city: c.city,
      state: c.state,
      segment: c.segment,
      branchName: c.branchId?.name || '—'
    })),
    total,
    pageNum,
    limitNum
  };
};

export const fetchCustomerById = async (id) => {
  const customer = await Customer.findById(id).populate('branchId').lean();
  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: customer._id.toString(),
    ...customer
  };
};

export const createNewCustomer = async (data) => {
  const count = await Customer.countDocuments();
  const customerNumber = `CUST-${String(count + 1).padStart(4, '0')}`;

  const customer = await Customer.create({
    ...data,
    customerNumber
  });

  return {
    id: customer._id.toString(),
    customerNumber: customer.customerNumber,
    companyName: customer.companyName
  };
};
