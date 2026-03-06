import mongoose from 'mongoose';

const FriendRequestSchema = new mongoose.Schema({
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
  },
  createdAt: { type: Number, default: () => Date.now() },
});

const FriendshipSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  friendUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:    { type: Number, default: () => Date.now() },
});

export const FriendRequest = mongoose.models.FriendRequest
  || mongoose.model('FriendRequest', FriendRequestSchema);

export const Friendship = mongoose.models.Friendship
  || mongoose.model('Friendship', FriendshipSchema);
