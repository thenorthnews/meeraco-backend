import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['lead_assigned', 'quote_approval_needed', 'quote_approved', 'quote_rejected', 'quote_sent', 'general'],
    default: 'general'
  },
  entityId: {
    type: String,
    default: null
  },
  entityType: {
    type: String,
    enum: ['lead', 'quotation', 'customer', 'task', 'general'],
    default: 'general'
  },
  link: {
    type: String,
    default: ''
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
export { Notification };

