import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { DmConversation, DmMessage } from '@/models/Dm';
import User from '@/models/User';

// GET /api/dm/conversations/[id]/messages - 消息列表（轮询）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const { id } = await params;
    const conv = await DmConversation.findById(id);
    if (!conv || !conv.participants.map(String).includes(userId)) {
      return Response.json({ success: false, error: '会话不存在' }, { status: 404 });
    }

    // 支持 ?after=timestamp 增量拉取
    const afterTs = Number(req.nextUrl.searchParams.get('after') || 0);
    const query: any = { conversationId: id };
    if (afterTs) query.createdAt = { $gt: afterTs };

    const messages = await DmMessage.find(query)
      .sort({ createdAt: 1 })
      .limit(100);

    // 获取发送者信息
    const senderIds = [...new Set(messages.map(m => String(m.senderId)))];
    const users = await User.find({ _id: { $in: senderIds } }).select('_id nickname avatar');
    const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));

    return Response.json({
      success: true,
      data: messages.map(m => ({
        id: String(m._id),
        senderId: String(m.senderId),
        senderNickname: userMap[String(m.senderId)]?.nickname || '未知',
        senderAvatar: userMap[String(m.senderId)]?.avatar,
        content: m.content,
        type: (m as any).type || 'text',
        createdAt: m.createdAt,
        isSelf: String(m.senderId) === userId,
      })),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}

// POST /api/dm/conversations/[id]/messages - 发送消息
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const { id } = await params;
    const conv = await DmConversation.findById(id);
    if (!conv || !conv.participants.map(String).includes(userId)) {
      return Response.json({ success: false, error: '会话不存在' }, { status: 404 });
    }

    const { content, type = 'text' } = await req.json();
    if (!content?.trim()) return Response.json({ success: false, error: '消息不能为空' }, { status: 400 });

    const msg = await DmMessage.create({
      conversationId: id,
      senderId: userId,
      content: type === 'image' ? content : content.trim(),
      type,
    });

    // 更新会话最后消息和时间
    conv.lastMessage = type === 'image' ? '[图片]' : content.trim().slice(0, 50);
    conv.updatedAt = Date.now();
    await conv.save();

    return Response.json({
      success: true,
      data: {
        id: String(msg._id),
        senderId: userId,
        content: msg.content,
        type,
        createdAt: msg.createdAt,
        isSelf: true,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '发送失败' }, { status: 500 });
  }
}
