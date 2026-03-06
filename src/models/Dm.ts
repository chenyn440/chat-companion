import mongoose from 'mongoose';

// 私信会话（两个用户之间唯一）
const DmConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  createdAt: { type: Number, default: () => Date.now() },
  updatedAt: { type: Number, default: () => Date.now() },
  lastMessage: { type: String, default: '' },
});

// 私信消息
const DmMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'DmConversation', required: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:        { type: String, required: true },
  createdAt:      { type: Number, default: () => Date.now() },
});

export const DmConversation = mongoose.models.DmConversation
  || mongoose.model('DmConversation', DmConversationSchema);

export const DmMessage = mongoose.models.DmMessage
  || mongoose.model('DmMessage', DmMessageSchema);
