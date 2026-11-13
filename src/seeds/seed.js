import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import { SuperAdmin, Role, RolePermission, User, Branch, Product, Lead, Customer, LeadActivity } from '../models/index.js';

const MODULES = [
  'dashboard', 'leads', 'reassign', 'customers', 'follow_ups',
  'quotations', 'reports', 'users', 'roles', 'branches',
  'lead_setup', 'assignment', 'import', 'catalogue',
  'quotation_settings', 'reminder_settings', 'report_access',
  'integration', 'audit', 'mobile_access', 'general_settings'
];

async function seedDatabase() {
  console.log('🌱 Starting MongoDB Database Seeding with Professional Production Data...');
  await connectDB();

  // 0. Clear existing data
  await Promise.all([
    SuperAdmin.deleteMany({}),
    Role.deleteMany({}),
    RolePermission.deleteMany({}),
    User.deleteMany({}),
    Branch.deleteMany({}),
    Product.deleteMany({}),
    Lead.deleteMany({}),
    Customer.deleteMany({}),
    LeadActivity.deleteMany({})
  ]);
  console.log('🧹 Cleaned existing database collections');

  const defaultPassword = await bcrypt.hash('meeraco@123', 10);

  // 1. Super Admin & Company Profile
  const superAdmin = await SuperAdmin.create({
    name: 'Meera Rao',
    email: 'owner@meeraco.demo',
    password: defaultPassword,
    mobile: '9810012345',
    role: 'super_admin',
    organizationName: 'Meeraco Power Systems Pvt Ltd',
    brandTagline: 'Industrial Power Generators & Clean Energy Solutions',
    website: 'https://meeraco.com',
    supportEmail: 'support@meeraco.com',
    supportPhone: '+91 11 4000 1000',
    registeredAddress: 'Plot 42, Okhla Industrial Area Phase 2',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110020',
    gstin: '07AABCM1234C1Z5',
    pan: 'AABCM1234C',
    cin: 'U29308DL2015PTC123456',
    currency: 'INR',
    financialYearStart: '04-01',
    financialYearEnd: '03-31'
  });
  console.log('✅ Super Admin & Organization Profile created');

  // 2. Roles
  const roles = await Role.create([
    {
      name: 'Admin',
      description: 'System Administrator with full access across all branches and modules.',
      scope: 'all',
      isSystem: true
    },
    {
      name: 'Sales Manager',
      description: 'Branch head managing leads, quotes, discounts, and team performance.',
      scope: 'districts',
      isSystem: true
    },
    {
      name: 'Sales Executive',
      description: 'Field executive handling assigned customer leads and quotes.',
      scope: 'own',
      isSystem: true
    }
  ]);
  console.log('✅ Roles created (Admin, Sales Manager, Sales Executive)');

  const adminRole = roles[0];
  const managerRole = roles[1];
  const execRole = roles[2];

  // 3. Role Permissions
  for (const mod of MODULES) {
    // Admin gets full permissions
    await RolePermission.create({
      roleId: adminRole._id,
      module: mod,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: mod !== 'roles',
      canExport: true
    });

    // Sales Manager
    const mgrCanView = ['dashboard', 'leads', 'reassign', 'customers', 'follow_ups', 'quotations', 'reports', 'users', 'branches', 'catalogue'].includes(mod);
    const mgrCanCreate = ['leads', 'customers', 'follow_ups', 'quotations'].includes(mod);
    await RolePermission.create({
      roleId: managerRole._id,
      module: mod,
      canView: mgrCanView,
      canCreate: mgrCanCreate,
      canEdit: mgrCanCreate,
      canDelete: false,
      canExport: ['leads', 'customers', 'quotations', 'reports'].includes(mod)
    });

    // Sales Executive
    const execCan = ['dashboard', 'leads', 'customers', 'follow_ups', 'quotations', 'catalogue'].includes(mod);
    await RolePermission.create({
      roleId: execRole._id,
      module: mod,
      canView: execCan,
      canCreate: execCan && mod !== 'dashboard' && mod !== 'catalogue',
      canEdit: execCan && mod !== 'dashboard' && mod !== 'catalogue',
      canDelete: false,
      canExport: false
    });
  }
  console.log('✅ Role permissions mapped for all 14 modules');

  // 4. Branches
  const delhiBranch = await Branch.create({
    name: 'Delhi NCR',
    code: 'DEL',
    city: 'New Delhi',
    state: 'Delhi',
    address: 'Plot 42, Okhla Industrial Area Phase 2, New Delhi',
    phone: '011-40001000',
    email: 'delhi@meeraco.com',
    active: true,
    territories: [
      {
        state: 'Delhi',
        districts: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi']
      }
    ]
  });

  const mumbaiBranch = await Branch.create({
    name: 'Mumbai',
    code: 'MUM',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'Unit 402, Trade Centre, BKC, Bandra East, Mumbai',
    phone: '022-40001000',
    email: 'mumbai@meeraco.com',
    active: true,
    territories: [
      {
        state: 'Maharashtra',
        districts: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Palghar', 'Raigad', 'Pune']
      }
    ]
  });

  const blrBranch = await Branch.create({
    name: 'Bengaluru',
    code: 'BLR',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '5th Block, Koramangala Industrial Layout, Bengaluru',
    phone: '080-40001000',
    email: 'bengaluru@meeraco.com',
    active: true,
    territories: [
      {
        state: 'Karnataka',
        districts: ['Bangalore Urban', 'Bangalore Rural', 'Ramanagara', 'Kolar']
      }
    ]
  });
  console.log('✅ Branches created (Delhi NCR, Mumbai, Bengaluru)');

  // 5. Users
  // Admin user
  const adminUser = await User.create({
    name: 'Meera Rao',
    email: 'owner@meeraco.demo',
    password: defaultPassword,
    mobile: '9810012345',
    roleId: adminRole._id,
    branchId: delhiBranch._id,
    managerId: null,
    districts: [],
    active: true,
    mobileAccess: true
  });

  // Sales Managers (1 per branch)
  const mgrDelhi = await User.create({
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@meeraco.com',
    password: defaultPassword,
    mobile: '9810023456',
    roleId: managerRole._id,
    branchId: delhiBranch._id,
    managerId: adminUser._id,
    districts: ['Central Delhi', 'New Delhi', 'South Delhi', 'West Delhi'],
    active: true,
    mobileAccess: true
  });

  const mgrMumbai = await User.create({
    name: 'Priya Deshmukh',
    email: 'priya.deshmukh@meeraco.com',
    password: defaultPassword,
    mobile: '9820034567',
    roleId: managerRole._id,
    branchId: mumbaiBranch._id,
    managerId: adminUser._id,
    districts: ['Mumbai City', 'Mumbai Suburban', 'Thane'],
    active: true,
    mobileAccess: true
  });

  const mgrBlr = await User.create({
    name: 'Vikram Reddy',
    email: 'vikram.reddy@meeraco.com',
    password: defaultPassword,
    mobile: '9845045678',
    roleId: managerRole._id,
    branchId: blrBranch._id,
    managerId: adminUser._id,
    districts: ['Bangalore Urban', 'Bangalore Rural'],
    active: true,
    mobileAccess: true
  });

  // Sales Executives (Reporting to respective Managers)
  const execDelhi1 = await User.create({
    name: 'Amit Verma',
    email: 'amit.verma@meeraco.com',
    password: defaultPassword,
    mobile: '9810056789',
    roleId: execRole._id,
    branchId: delhiBranch._id,
    managerId: mgrDelhi._id,
    districts: ['Central Delhi', 'New Delhi'],
    active: true,
    mobileAccess: true
  });

  const execDelhi2 = await User.create({
    name: 'Sneha Kapoor',
    email: 'sneha.kapoor@meeraco.com',
    password: defaultPassword,
    mobile: '9810067890',
    roleId: execRole._id,
    branchId: delhiBranch._id,
    managerId: mgrDelhi._id,
    districts: ['South Delhi', 'West Delhi'],
    active: true,
    mobileAccess: true
  });

  const execMumbai = await User.create({
    name: 'Rohan Mehta',
    email: 'rohan.mehta@meeraco.com',
    password: defaultPassword,
    mobile: '9820078901',
    roleId: execRole._id,
    branchId: mumbaiBranch._id,
    managerId: mgrMumbai._id,
    districts: ['Mumbai City', 'Thane'],
    active: true,
    mobileAccess: true
  });

  const execBlr = await User.create({
    name: 'Ananya Swamy',
    email: 'ananya.swamy@meeraco.com',
    password: defaultPassword,
    mobile: '9845089012',
    roleId: execRole._id,
    branchId: blrBranch._id,
    managerId: mgrBlr._id,
    districts: ['Bangalore Urban'],
    active: true,
    mobileAccess: true
  });
  console.log('✅ Users created (1 Admin, 3 Sales Managers, 4 Sales Executives)');

  // 6. Update Branches with their designated Managers
  await Branch.findByIdAndUpdate(delhiBranch._id, { managerId: mgrDelhi._id.toString() });
  await Branch.findByIdAndUpdate(mumbaiBranch._id, { managerId: mgrMumbai._id.toString() });
  await Branch.findByIdAndUpdate(blrBranch._id, { managerId: mgrBlr._id.toString() });
  console.log('✅ Branch Managers linked to respective branches');

  // 7. Products (Genset Catalogue)
  await Product.create([
    { code: 'GS-15', kind: 'Genset', name: 'MG 15 Silent Canopy', kva: 15, basePrice: 385000, gstPct: 18 },
    { code: 'GS-30', kind: 'Genset', name: 'MG 30 Silent Diesel', kva: 30, basePrice: 620000, gstPct: 18 },
    { code: 'GS-62', kind: 'Genset', name: 'MG 62.5 Silent Power', kva: 62.5, basePrice: 980000, gstPct: 18 },
    { code: 'GS-125', kind: 'Genset', name: 'MG 125 Heavy Industrial', kva: 125, basePrice: 1750000, gstPct: 18 },
    { code: 'GS-250', kind: 'Genset', name: 'MG 250 Prime Power', kva: 250, basePrice: 3150000, gstPct: 18 },
    { code: 'GS-500', kind: 'Genset', name: 'MG 500 Mega Grid Prime', kva: 500, basePrice: 6200000, gstPct: 18 }
  ]);
  console.log('✅ Genset Catalogue populated');

  // 8. Customers (Won Clients)
  const cust1 = await Customer.create({
    customerNumber: 'CUST-0001',
    name: 'Sunrise Mills & Textiles',
    companyName: 'Sunrise Mills & Textiles Pvt Ltd',
    type: 'Business',
    industry: 'Textiles',
    segment: 'Industrial',
    gstin: '07AAACS1234D1Z2',
    city: 'New Delhi',
    district: 'Central Delhi',
    state: 'Delhi',
    pincode: '110006',
    billingAddress: '44 Commercial Enclave, Chandni Chowk, Delhi',
    siteAddresses: ['Plant 1: Bawana Industrial Area, Sector 5, Delhi'],
    branchId: delhiBranch._id,
    ownerId: execDelhi1._id,
    active: true,
    contacts: [{
      name: 'Harish Agarwal',
      mobile: '9811134567',
      email: 'harish@sunrisemills.com',
      designation: 'Managing Director',
      primary: true
    }]
  });

  const cust2 = await Customer.create({
    customerNumber: 'CUST-0002',
    name: 'Kalyan Warehousing Hub',
    companyName: 'Kalyan Logistics & Warehousing Hub',
    type: 'Business',
    industry: 'Logistics',
    segment: 'Commercial',
    gstin: '27AABCK5678E1Z9',
    city: 'Mumbai',
    district: 'Thane',
    state: 'Maharashtra',
    pincode: '421302',
    billingAddress: 'Warehouse Zone 14, Bhiwandi-Kalyan Highway, Thane',
    siteAddresses: ['Warehouse 3: Bhiwandi Logistics Park, Thane'],
    branchId: mumbaiBranch._id,
    ownerId: execMumbai._id,
    active: true,
    contacts: [{
      name: 'Sanjay Patil',
      mobile: '9822245678',
      email: 'sanjay@kalyanhub.in',
      designation: 'Head of Operations',
      primary: true
    }]
  });
  console.log('✅ Customers created');

  // 9. Realistic Leads across all Stages
  const leadsData = [
    {
      leadNumber: 'L-0001',
      name: 'Dr. Rajiv Malhotra',
      company: 'Apex Multi-Speciality Hospital',
      phone: '9811112233',
      email: 'rajiv.malhotra@apexhospital.in',
      city: 'New Delhi',
      state: 'Delhi',
      district: 'New Delhi',
      pincode: '110001',
      siteLocation: 'Barakhamba Road, Connaught Place, New Delhi',
      source: 'Direct Enquiry',
      priority: 'Hot',
      stage: 'New',
      status: 'Active',
      kva: 250,
      quantity: 1,
      estimatedValue: 3150000,
      expectedClose: new Date(Date.now() + 15 * 86400000),
      branchId: delhiBranch._id,
      assignedToId: execDelhi1._id,
      assignedById: mgrDelhi._id,
      createdById: mgrDelhi._id,
      notes: [{ text: 'Hospital requires 250 kVA silent DG set with AMF panel for ICU power backup.', by: mgrDelhi.name, at: new Date() }],
      stageHistory: [{ stage: 'New', by: mgrDelhi.name, at: new Date() }]
    },
    {
      leadNumber: 'L-0002',
      name: 'Sunil Grover',
      company: 'Metro Buildtech Pvt Ltd',
      phone: '9811123456',
      email: 'sunil@metrobuildtech.com',
      city: 'New Delhi',
      state: 'Delhi',
      district: 'South Delhi',
      pincode: '110019',
      siteLocation: 'Commercial Complex Project, Nehru Place, New Delhi',
      source: 'Google Ads',
      priority: 'Warm',
      stage: 'Contacted',
      status: 'Active',
      kva: 500,
      quantity: 1,
      estimatedValue: 6200000,
      expectedClose: new Date(Date.now() + 25 * 86400000),
      branchId: delhiBranch._id,
      assignedToId: execDelhi2._id,
      assignedById: mgrDelhi._id,
      createdById: mgrDelhi._id,
      notes: [{ text: 'Introductory call done. Shared product brochure for 500 kVA genset.', by: execDelhi2.name, at: new Date() }],
      stageHistory: [
        { stage: 'New', by: mgrDelhi.name, at: new Date(Date.now() - 3 * 86400000) },
        { stage: 'Contacted', by: execDelhi2.name, at: new Date() }
      ]
    },
    {
      leadNumber: 'L-0003',
      name: 'Kunal Shah',
      company: 'Blue Star Packaging Industries',
      phone: '9822234567',
      email: 'kunal.shah@bluestarpack.com',
      city: 'Thane',
      state: 'Maharashtra',
      district: 'Thane',
      pincode: '400604',
      siteLocation: 'Wagle Industrial Estate, Thane West',
      source: 'Referral',
      priority: 'Hot',
      stage: 'Requirement',
      status: 'Active',
      kva: 125,
      quantity: 2,
      estimatedValue: 3500000,
      expectedClose: new Date(Date.now() + 10 * 86400000),
      branchId: mumbaiBranch._id,
      assignedToId: execMumbai._id,
      assignedById: mgrMumbai._id,
      createdById: mgrMumbai._id,
      notes: [{ text: 'Site visit completed. Customer requires twin 125 kVA synchronized setup.', by: execMumbai.name, at: new Date() }],
      stageHistory: [
        { stage: 'New', by: mgrMumbai.name, at: new Date(Date.now() - 5 * 86400000) },
        { stage: 'Contacted', by: execMumbai.name, at: new Date(Date.now() - 3 * 86400000) },
        { stage: 'Requirement', by: execMumbai.name, at: new Date() }
      ]
    },
    {
      leadNumber: 'L-0004',
      name: 'Vinay Shenoy',
      company: 'Orchid Data Centers',
      phone: '9844456789',
      email: 'vinay@orchiddatacenter.in',
      city: 'Bengaluru',
      state: 'Karnataka',
      district: 'Bangalore Urban',
      pincode: '560100',
      siteLocation: 'Electronics City Phase 1, Hosur Road, Bengaluru',
      source: 'Tender / Enterprise',
      priority: 'Hot',
      stage: 'Quotation',
      status: 'Active',
      kva: 500,
      quantity: 2,
      estimatedValue: 12400000,
      expectedClose: new Date(Date.now() + 7 * 86400000),
      branchId: blrBranch._id,
      assignedToId: execBlr._id,
      assignedById: mgrBlr._id,
      createdById: mgrBlr._id,
      notes: [{ text: 'Quotation submitted for 2x 500 kVA generators with acoustic enclosure and AMC.', by: execBlr.name, at: new Date() }],
      stageHistory: [
        { stage: 'New', by: mgrBlr.name, at: new Date(Date.now() - 7 * 86400000) },
        { stage: 'Requirement', by: execBlr.name, at: new Date(Date.now() - 4 * 86400000) },
        { stage: 'Quotation', by: execBlr.name, at: new Date() }
      ]
    },
    {
      leadNumber: 'L-0005',
      name: 'Harish Agarwal',
      company: 'Sunrise Mills & Textiles Pvt Ltd',
      phone: '9811134567',
      email: 'harish@sunrisemills.com',
      city: 'New Delhi',
      state: 'Delhi',
      district: 'Central Delhi',
      pincode: '110006',
      siteLocation: 'Bawana Industrial Area, Sector 5, Delhi',
      source: 'Direct Enquiry',
      priority: 'Warm',
      stage: 'Won',
      status: 'Converted',
      kva: 125,
      quantity: 1,
      estimatedValue: 1750000,
      expectedClose: new Date(Date.now() - 2 * 86400000),
      branchId: delhiBranch._id,
      assignedToId: execDelhi1._id,
      assignedById: mgrDelhi._id,
      createdById: mgrDelhi._id,
      customerId: cust1._id,
      notes: [{ text: 'Advance PO received. Converted to Customer.', by: execDelhi1.name, at: new Date() }],
      stageHistory: [
        { stage: 'New', by: mgrDelhi.name, at: new Date(Date.now() - 10 * 86400000) },
        { stage: 'Quotation', by: execDelhi1.name, at: new Date(Date.now() - 5 * 86400000) },
        { stage: 'Won', by: execDelhi1.name, at: new Date(Date.now() - 2 * 86400000) }
      ]
    },
    {
      leadNumber: 'L-0006',
      name: 'Sanjay Patil',
      company: 'Kalyan Logistics & Warehousing Hub',
      phone: '9822245678',
      email: 'sanjay@kalyanhub.in',
      city: 'Mumbai',
      state: 'Maharashtra',
      district: 'Thane',
      pincode: '421302',
      siteLocation: 'Bhiwandi-Kalyan Highway, Thane',
      source: 'Cold Call',
      priority: 'Hot',
      stage: 'Won',
      status: 'Converted',
      kva: 250,
      quantity: 1,
      estimatedValue: 3150000,
      expectedClose: new Date(Date.now() - 1 * 86400000),
      branchId: mumbaiBranch._id,
      assignedToId: execMumbai._id,
      assignedById: mgrMumbai._id,
      createdById: mgrMumbai._id,
      customerId: cust2._id,
      notes: [{ text: 'Deal won. Installation scheduled.', by: execMumbai.name, at: new Date() }],
      stageHistory: [
        { stage: 'New', by: mgrMumbai.name, at: new Date(Date.now() - 8 * 86400000) },
        { stage: 'Quotation', by: execMumbai.name, at: new Date(Date.now() - 3 * 86400000) },
        { stage: 'Won', by: execMumbai.name, at: new Date(Date.now() - 1 * 86400000) }
      ]
    },
    {
      leadNumber: 'L-0007',
      name: 'Mohit Khanna',
      company: 'Vibrant Logistics Cold Storage',
      phone: '9811145678',
      email: 'mohit@vibrantlogistics.in',
      city: 'New Delhi',
      state: 'Delhi',
      district: 'West Delhi',
      pincode: '110027',
      siteLocation: 'Mayapuri Industrial Area Phase 1, New Delhi',
      source: 'Website Form',
      priority: 'Cold',
      stage: 'Lost',
      status: 'Closed',
      lossReason: 'Customer opted for second-hand DG set due to budget constraints',
      kva: 62.5,
      quantity: 1,
      estimatedValue: 980000,
      expectedClose: new Date(Date.now() - 4 * 86400000),
      branchId: delhiBranch._id,
      assignedToId: execDelhi2._id,
      assignedById: mgrDelhi._id,
      createdById: mgrDelhi._id,
      notes: [{ text: 'Lost to competitor / budget issue.', by: execDelhi2.name, at: new Date() }],
      stageHistory: [
        { stage: 'New', by: mgrDelhi.name, at: new Date(Date.now() - 12 * 86400000) },
        { stage: 'Lost', by: execDelhi2.name, at: new Date(Date.now() - 4 * 86400000) }
      ]
    }
  ];

  await Lead.create(leadsData);
  console.log('✅ Realistic Leads created across all stages (New, Contacted, Requirement, Quotation, Won, Lost)');

  console.log('\n🎉 ALL PRODUCTION SEED DATA COMPLETED SUCCESSFULLY!');
  console.log('----------------------------------------------------');
  console.log('🔑 Login Credentials (Password for all: meeraco@123)');
  console.log('👑 Admin: owner@meeraco.demo (Meera Rao)');
  console.log('👔 Sales Manager (Delhi): rajesh.sharma@meeraco.com');
  console.log('👔 Sales Manager (Mumbai): priya.deshmukh@meeraco.com');
  console.log('👔 Sales Manager (Bengaluru): vikram.reddy@meeraco.com');
  console.log('👤 Sales Executive (Delhi): amit.verma@meeraco.com');
  console.log('👤 Sales Executive (Delhi): sneha.kapoor@meeraco.com');
  console.log('👤 Sales Executive (Mumbai): rohan.mehta@meeraco.com');
  console.log('👤 Sales Executive (Bengaluru): ananya.swamy@meeraco.com');
  console.log('----------------------------------------------------');

  await mongoose.disconnect();
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
