import mongoose from 'mongoose';

const ShareSchema = new mongoose.Schema({
  shareId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: '对话分享',
  },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: { type: String },
    timestamp: { type: Date },
  }],
  createdBy: { type: String },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
  },
  createdAt: { type: Number, default: () => Date.now() },
}, {
  timestamps: false,
});

export default mongoose.models.Share || mongoose.model('Share', ShareSchema);
