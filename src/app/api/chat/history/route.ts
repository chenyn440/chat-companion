import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!sessionId) {
      return NextResponse.json({ success: false, error: '缺少 sessionId' }, { status: 400 });
    }

    const session = await Session.findById(sessionId).lean();
    
    if (!session) {
      return NextResponse.json({ success: false, error: '会话不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session._id,
        title: session.title,
        mode: session.mode,
        character: session.character,
        messages: session.messages.slice(-limit),
      },
    });
  } catch (error) {
    console.error('Get history error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
