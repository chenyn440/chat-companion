import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { Friendship } from '@/models/Friend';

// POST /api/friends/[friendUserId]/remove
export async function POST(req: NextRequest, { params }: { params: Promise<{ friendUserId: string }> }) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });
    const { friendUserId } = await params;

    await Promise.all([
      Friendship.deleteOne({ userId, friendUserId }),
      Friendship.deleteOne({ userId: friendUserId, friendUserId: userId }),
    ]);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
