import mongoose from 'mongoose';


const superAdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Super Admin name is required'],
    trim: true,
    default: 'Meera Rao'
  },
  email: {
    type: String,
    required: [true, 'Super Admin email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    default: 'owner@meeraco.demo'
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    default: '9000000000'
  },
  role: {
    type: String,
    default: 'super_admin',
    immutable: true // Cannot be changed
  },
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // 2. Organization / Company Profile
  organizationName: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true,
    default: 'Meeraco Power Systems Pvt Ltd'
  },
  brandTagline: {
    type: String,
    default: 'Enterprise Power & Clean Tech Solutions'
  },
  logoUrl: {
    type: String,
    default: null // Light theme logo
  },
  darkLogoUrl: {
    type: String,
    default: null // Dark theme logo
  },
  faviconUrl: {
    type: String,
    default: null
  },
  website: {
    type: String,
    default: 'https://meeraco.com'
  },
  industry: {
    type: String,
    default: 'Genset & Power Systems'
  },

  supportEmail: {
    type: String,
    default: 'support@meeraco.com'
  },
  supportPhone: {
    type: String,
    default: '+91 11 4000 1000'
  },
  billingEmail: {
    type: String,
    default: 'billing@meeraco.com'
  },
  registeredAddress: {
    type: String,
    default: 'Plot 42, Okhla Industrial Area Phase 2'
  },
  city: {
    type: String,
    default: 'New Delhi'
  },
  state: {
    type: String,
    default: 'Delhi'
  },
  pincode: {
    type: String,
    default: '110020'
  },
  country: {
    type: String,
    default: 'India'
  },
  gstin: {
    type: String,
    default: '07AABCM1234C1Z5'
  },
  pan: {
    type: String,
    default: 'AABCM1234C'
  },
  cin: {
    type: String,
    default: 'U29308DL2015PTC123456'
  },
  msmeNumber: {
    type: String,
    default: null
  },

  // 6. Financial & Currency Settings
  currency: {
    type: String,
    default: 'INR'
  },
  currencySymbol: {
    type: String,
    default: '₹'
  },
  financialYearStart: {
    type: String,
    default: '04-01' // 1st April
  },
  financialYearEnd: {
    type: String,
    default: '03-31' // 31st March
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  dateFormat: {
    type: String,
    default: 'DD/MM/YYYY'
  },

  // 7. System Policies & Security
  allowMobileAccess: {
    type: Boolean,
    default: true
  },
  twoFactorAuthEnabled: {
    type: Boolean,
    default: false
  },
  sessionTimeoutMinutes: {
    type: Number,
    default: 120
  },
  maxLoginAttempts: {
    type: Number,
    default: 5
  },

  // 8. SMTP / Mail Server Setup
  smtpHost: {
    type: String,
    default: null
  },
  smtpPort: {
    type: Number,
    default: 587
  },
  smtpUser: {
    type: String,
    default: null
  },
  smtpPass: {
    type: String,
    default: null
  },
  senderEmail: {
    type: String,
    default: null
  },
  senderName: {
    type: String,
    default: 'Meeraco CRM Notifications'
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const SuperAdmin = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', superAdminSchema);

export default SuperAdmin;
export { SuperAdmin };

