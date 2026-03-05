import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  nickname: {
    type: String,
    default: '',
  },
  avatar: {
    type: String,
    default: '',
  },
  preferences: {
    defaultCharacter: {
      type: String,
      default: 'gentle',
    },
    defaultMode: {
      type: String,
      default: 'companion',
    },
  },
}, {
  timestamps: true,
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
