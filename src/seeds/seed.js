import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import { SuperAdmin, Role, RolePermission, User, Branch, Product } from '../models/index.js';

const MODULES = [
  'dashboard', 'leads', 'reassign', 'customers', 'follow_ups',
  'quotations', 'reports', 'users', 'roles', 'branches',
  'lead_setup', 'assignment', 'import', 'catalogue',
  'quotation_settings', 'reminder_settings', 'report_access',
  'integration', 'audit', 'mobile_access', 'general_settings'
];

async function seedDatabase() {
  console.log('🌱 Starting MongoDB Database Seeding...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    SuperAdmin.deleteMany(),
    Role.deleteMany(),
    RolePermission.deleteMany(),
    User.deleteMany(),
    Branch.deleteMany(),
    Product.deleteMany()
  ]);

  const defaultPassword = await bcrypt.hash('meeraco@123', 10);

  // 1. Super Admin & Organization
  const superAdmin = await SuperAdmin.create({
    name: 'Meera Rao',
    email: 'owner@meeraco.demo',
    password: defaultPassword,
    mobile: '9000000000',
    role: 'super_admin',
    organizationName: 'Meeraco Power Systems Pvt Ltd',
    brandTagline: 'Enterprise Workspace & Clean Tech Solutions',
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
      description: 'System Administrator with branch and team management rights.',
      scope: 'all',
      isSystem: false
    },
    {
      name: 'Sales Manager',
      description: 'Branch head managing leads, quotes, and team performance.',
      scope: 'districts',
      isSystem: false
    },
    {
      name: 'Sales Executive',
      description: 'Field executive handling assigned customer leads and quotes.',
      scope: 'own',
      isSystem: false
    }
  ]);
  console.log('✅ Roles created');

  const adminRole = roles[0];
  const managerRole = roles[1];
  const execRole = roles[2];

  // 3. Permissions for roles
  for (const mod of MODULES) {
    // Admin gets all except roles delete
    await RolePermission.create({
      roleId: adminRole._id,
      module: mod,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: mod !== 'roles',
      canExport: true
    });

    // Sales Manager gets sales permissions
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

    // Executive gets own leads & quotes
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
  console.log('✅ Role Permissions populated for all 14 modules');

  // 4. Branches
  const branches = await Branch.create([
    {
      name: 'Delhi NCR',
      code: 'DEL',
      city: 'New Delhi',
      state: 'Delhi',
      phone: '1140001000',
      email: 'delhi@meeraco.demo',
      territories: [
        { state: 'Delhi', districts: ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'South Delhi', 'West Delhi'] }
      ]
    },
    {
      name: 'Mumbai',
      code: 'MUM',
      city: 'Mumbai',
      state: 'Maharashtra',
      phone: '2240001000',
      email: 'mumbai@meeraco.demo',
      territories: [
        { state: 'Maharashtra', districts: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Palghar'] }
      ]
    },
    {
      name: 'Bengaluru',
      code: 'BLR',
      city: 'Bengaluru',
      state: 'Karnataka',
      phone: '8040001000',
      email: 'bengaluru@meeraco.demo',
      territories: [
        { state: 'Karnataka', districts: ['Bangalore Urban', 'Bangalore Rural'] }
      ]
    }
  ]);
  console.log('✅ Branches created with territories');

  // 5. Users table kept clean (dummy users removed as requested)
  console.log('✅ Users table cleaned (No dummy users seeded)');

  // 6. Products
  await Product.create([
    { code: 'GS-15', kind: 'Genset', name: 'MG 15 Silent', kva: 15, basePrice: 385000, gstPct: 18 },
    { code: 'GS-30', kind: 'Genset', name: 'MG 30 Silent', kva: 30, basePrice: 620000, gstPct: 18 },
    { code: 'GS-62', kind: 'Genset', name: 'MG 62.5 Silent', kva: 62.5, basePrice: 980000, gstPct: 18 },
    { code: 'GS-125', kind: 'Genset', name: 'MG 125 Industrial', kva: 125, basePrice: 1750000, gstPct: 18 },
    { code: 'GS-250', kind: 'Genset', name: 'MG 250 Industrial', kva: 250, basePrice: 3150000, gstPct: 18 },
    { code: 'GS-500', kind: 'Genset', name: 'MG 500 Prime', kva: 500, basePrice: 6200000, gstPct: 18 }
  ]);
  console.log('✅ Products catalogue populated');

  console.log('\n🎉 ALL MONGODB DATA SEEDED SUCCESSFULLY!');
  await mongoose.disconnect();
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

