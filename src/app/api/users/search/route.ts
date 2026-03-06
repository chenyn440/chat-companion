import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import User from '@/models/User';

// GET /api/users/search?q=keyword&userId=xxx
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const currentUserId = req.nextUrl.searchParams.get('userId');

    if (!q || q.length < 1) {
      return Response.json({ success: false, error: '请输入搜索关键字' }, { status: 400 });
    }

    const users = await User.find({
      $or: [
        { nickname: { $regex: q, $options: 'i' } },
        { phone: { $regex: q } },
      ],
      ...(currentUserId ? { _id: { $ne: currentUserId } } : {}),
    }).limit(20).select('_id nickname phone avatar');

    return Response.json({
      success: true,
      data: users.map(u => ({
        id: String(u._id),
        nickname: u.nickname,
        phone: (u.phone as string).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        avatar: u.avatar,
      })),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '搜索失败' }, { status: 500 });
  }
}
