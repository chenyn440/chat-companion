import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const favoriteOnly = searchParams.get('favorite') === 'true';
    
    if (!userId || userId === 'guest') {
      return NextResponse.json({ success: true, data: { sessions: [] } });
    }
    
    const query: any = { userId };
    if (favoriteOnly) query.isFavorite = true;

    const sessions = await Session.find(query)
      .sort({ updatedAt: -1 })
      .lean();
    
    const formattedSessions = sessions.map((session: any) => ({
      id: session._id.toString(),
      title: session.title || '新对话',
      mode: session.mode,
      character: session.character,
      updatedAt: session.updatedAt,
      lastMessage: session.messages?.[session.messages.length - 1]?.content || '',
      messageCount: session.messages?.length || 0,
      isFavorite: session.isFavorite ?? false,
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        sessions: formattedSessions,
        pagination: { page: 1, limit: 20, total: formattedSessions.length, totalPages: 1 },
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ success: false, error: '获取对话列表失败' }, { status: 500 });
  }
}
