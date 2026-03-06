import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { DmConversation } from '@/models/Dm';
import { Friendship } from '@/models/Friend';
import User from '@/models/User';

// POST /api/dm/conversations - 创建或获取与某好友的1v1会话
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const { friendId } = await req.json();
    if (!friendId) return Response.json({ success: false, error: '参数错误' }, { status: 400 });

    // 验证好友关系
    const friendship = await Friendship.findOne({ userId, friendUserId: friendId });
    if (!friendship) return Response.json({ success: false, error: '对方不是你的好友' }, { status: 403 });

    // 查找已有会话（participants 包含两人，且只有两人）
    const existing = await DmConversation.findOne({
      participants: { $all: [userId, friendId], $size: 2 },
    });
    if (existing) {
      return Response.json({ success: true, data: { conversationId: String(existing._id) } });
    }

    // 创建新会话
    const conv = await DmConversation.create({ participants: [userId, friendId] });
    return Response.json({ success: true, data: { conversationId: String(conv._id) } });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// GET /api/dm/conversations - 会话列表
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const convs = await DmConversation.find({ participants: userId }).sort({ updatedAt: -1 });

    // 获取对方用户信息
    const friendIds = convs.map(c =>
      c.participants.find((p: any) => String(p) !== userId)
    ).filter(Boolean);
    const friends = await User.find({ _id: { $in: friendIds } }).select('_id nickname avatar');
    const friendMap = Object.fromEntries(friends.map(u => [String(u._id), u]));

    return Response.json({
      success: true,
      data: convs.map(c => {
        const fid = String(c.participants.find((p: any) => String(p) !== userId));
        const f = friendMap[fid];
        return {
          conversationId: String(c._id),
          friend: { id: fid, nickname: f?.nickname || '未知用户', avatar: f?.avatar },
          lastMessage: c.lastMessage,
          updatedAt: c.updatedAt,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
