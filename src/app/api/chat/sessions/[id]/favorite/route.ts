import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';

/** PATCH /api/chat/sessions/[id]/favorite — 切换收藏状态 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const session = await Session.findByIdAndUpdate(
      id,
      { isFavorite: body.isFavorite },
      { new: true }
    );
    if (!session) return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });

    return NextResponse.json({ success: true, data: { isFavorite: session.isFavorite } });
  } catch (error) {
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
