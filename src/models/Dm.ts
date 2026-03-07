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
  type:           { type: String, enum: ['text', 'image'], default: 'text' }, // 消息类型
  clientMsgId:    { type: String, default: null },  // 前端去重 ID
  createdAt:      { type: Number, default: () => Date.now() },
});

// 强制重建 model，避免 Next.js hot reload 时缓存旧 Schema（缺 type 字段会导致图片消息 type 丢失）
if (mongoose.models.DmMessage) {
  delete (mongoose.models as any).DmMessage;
}
if (mongoose.models.DmConversation) {
  delete (mongoose.models as any).DmConversation;
}

export const DmConversation = mongoose.model('DmConversation', DmConversationSchema);
export const DmMessage = mongoose.model('DmMessage', DmMessageSchema);
