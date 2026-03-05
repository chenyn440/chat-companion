import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    // 从 cookie 验证登录状态
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId || userId === 'guest') {
      return NextResponse.json({
        success: true,
        data: { sessions: [] },
      });
    }
    
    // 从数据库获取用户的所有会话
    const sessions = await Session.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();
    
    // 格式化数据
    const formattedSessions = sessions.map((session: any) => ({
      id: session._id.toString(),
      title: session.title || '新对话',
      mode: session.mode,
      character: session.character,
      updatedAt: session.updatedAt,
      lastMessage: session.messages?.[session.messages.length - 1]?.content || '',
      messageCount: session.messages?.length || 0,
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: {
          page: 1,
          limit: 20,
          total: formattedSessions.length,
          totalPages: 1,
        },
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { success: false, error: '获取对话列表失败' },
      { status: 500 }
    );
  }
}
