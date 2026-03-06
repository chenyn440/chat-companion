import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { FriendRequest, Friendship } from '@/models/Friend';

// POST /api/friends/request/[id]/accept
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const fr = await FriendRequest.findById(id);
    if (!fr || fr.status !== 'pending') {
      return Response.json({ success: false, error: '申请不存在或已处理' }, { status: 404 });
    }
    fr.status = 'accepted';
    await fr.save();

    // 双向建立好友关系
    await Promise.all([
      Friendship.create({ userId: fr.fromUserId, friendUserId: fr.toUserId }),
      Friendship.create({ userId: fr.toUserId, friendUserId: fr.fromUserId }),
    ]);
    return Response.json({ success: true });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
