import mongoose from 'mongoose';

const MoodSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  mood: {
    type: String,
    required: true,
    enum: ['happy', 'sad', 'angry', 'anxious', 'neutral'],
  },
  content: {
    type: String,
    default: '',
  },
  aiResponse: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// 复合索引：每个用户每天只能有一条记录
MoodSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.models.Mood || mongoose.model('Mood', MoodSchema);
