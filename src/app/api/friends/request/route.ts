import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { FriendRequest, Friendship } from '@/models/Friend';

// POST /api/friends/request - 发起好友申请
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const fromUserId = req.headers.get('x-user-id');
    if (!fromUserId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const { toUserId } = await req.json();
    if (!toUserId) return Response.json({ success: false, error: '参数错误' }, { status: 400 });
    if (fromUserId === toUserId) return Response.json({ success: false, error: '不能添加自己' }, { status: 400 });

    // 已是好友
    const already = await Friendship.findOne({ userId: fromUserId, friendUserId: toUserId });
    if (already) return Response.json({ success: false, error: '你们已经是好友了' }, { status: 400 });

    // 已有 pending 申请
    const pending = await FriendRequest.findOne({ fromUserId, toUserId, status: 'pending' });
    if (pending) return Response.json({ success: false, error: '已发送申请，等待对方同意' }, { status: 400 });

    await FriendRequest.create({ fromUserId, toUserId });
    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}

// GET /api/friends/request - 申请列表（收到的 + 发出的）
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const received = await FriendRequest.find({ toUserId: userId, status: 'pending' })
      .populate('fromUserId', 'nickname phone avatar').sort({ createdAt: -1 });
    const sent = await FriendRequest.find({ fromUserId: userId, status: { $in: ['pending', 'rejected'] } })
      .populate('toUserId', 'nickname phone avatar').sort({ createdAt: -1 });

    const fmt = (u: any) => u ? { id: String(u._id), nickname: u.nickname, phone: u.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), avatar: u.avatar } : null;

    return Response.json({
      success: true,
      data: {
        received: received.map(r => ({ id: String(r._id), from: fmt(r.fromUserId), status: r.status, createdAt: r.createdAt })),
        sent:     sent.map(r => ({ id: String(r._id), to: fmt(r.toUserId), status: r.status, createdAt: r.createdAt })),
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
