import mongoose from 'mongoose';

const generalSettingSchema = new mongoose.Schema({
  companyName: { type: String, default: 'Meeraco Power Systems Pvt Ltd' },
  logoUrl: { type: String, default: null },
  registeredAddress: { type: String, default: null },
  gstin: { type: String, default: null },
  financialYearStart: { type: String, default: '04-01' }
}, {
  timestamps: true
});

const GeneralSetting = mongoose.models.GeneralSetting || mongoose.model('GeneralSetting', generalSettingSchema);

export default GeneralSetting;
export { GeneralSetting };
