import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  emotion: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const SessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    default: function() {
      return `${new Date().getMonth() + 1}月${new Date().getDate()}日的对话`;
    },
  },
  mode: {
    type: String,
    enum: ['treehole', 'advice', 'companion'],
    default: 'companion',
  },
  character: {
    type: String,
    enum: ['gentle', 'rational', 'funny', 'elder'],
    default: 'gentle',
  },
  messages: [MessageSchema],
  isFavorite: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
