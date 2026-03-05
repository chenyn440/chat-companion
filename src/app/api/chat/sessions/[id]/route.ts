import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const session = await Session.findById(id).lean();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: '会话不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session._id,
          title: session.title || '新对话',
          mode: session.mode,
          character: session.character,
          messages: session.messages,
          updatedAt: session.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { success: false, error: '获取会话失败' },
      { status: 500 }
    );
  }
}
