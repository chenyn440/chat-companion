import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { FriendRequest, Friendship } from '@/models/Friend';
import User from '@/models/User';

// GET /api/friends - 好友列表
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const friendships = await Friendship.find({ userId }).sort({ createdAt: -1 });
    const friendIds = friendships.map(f => f.friendUserId);
    const friends = await User.find({ _id: { $in: friendIds } }).select('_id nickname phone avatar');

    const friendMap = Object.fromEntries(friends.map(u => [String(u._id), u]));

    return Response.json({
      success: true,
      data: friendships.map(f => {
        const u = friendMap[String(f.friendUserId)];
        return {
          id: String(f.friendUserId),
          nickname: u?.nickname || '未知用户',
          phone: u ? (u.phone as string).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
          avatar: u?.avatar,
          createdAt: f.createdAt,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
