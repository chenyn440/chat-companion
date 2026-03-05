import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }
    
    // 获取用户所有会话
    const sessions = await Session.find({ userId }).lean();
    
    // 计算统计数据
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, session) => 
      sum + (session.messages?.length || 0), 0
    );
    
    // 计算使用天数（根据用户创建时间和最后活跃时间）
    const user = await User.findById(userId).lean();
    const createdAt = user?.createdAt ? new Date(user.createdAt) : new Date();
    const lastActive = sessions.length > 0 
      ? new Date(Math.max(...sessions.map(s => new Date(s.updatedAt).getTime())))
      : createdAt;
    const usageDays = Math.max(1, Math.ceil((lastActive.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    
    // 统计最喜欢的角色
    const characterCount: Record<string, number> = {};
    sessions.forEach(session => {
      const char = session.character || 'gentle';
      characterCount[char] = (characterCount[char] || 0) + 1;
    });
    const favoriteCharacter = Object.entries(characterCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'gentle';
    
    const characterLabels: Record<string, string> = {
      gentle: '温柔知心',
      rational: '理性分析',
      funny: '幽默风趣',
      elder: '长辈关怀',
    };
    
    return NextResponse.json({
      success: true,
      data: {
        totalSessions,
        totalMessages,
        usageDays,
        favoriteCharacter: characterLabels[favoriteCharacter] || favoriteCharacter,
        favoriteCharacterKey: favoriteCharacter,
      },
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return NextResponse.json(
      { success: false, error: '获取用户统计失败' },
      { status: 500 }
    );
  }
}
