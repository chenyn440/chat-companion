import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import { FriendRequest } from '@/models/Friend';

// POST /api/friends/request/[id]/reject
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const fr = await FriendRequest.findById(id);
    if (!fr || fr.status !== 'pending') {
      return Response.json({ success: false, error: '申请不存在或已处理' }, { status: 404 });
    }
    fr.status = 'rejected';
    await fr.save();
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
