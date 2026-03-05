import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    // 从 cookie 获取 token
    const token = req.cookies.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // MVP 阶段：从 localStorage 获取用户ID（前端会在请求头中传递）
    const userId = req.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户信息' },
        { status: 400 }
      );
    }

    // 获取用户信息
    const user = await User.findById(userId).lean();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: String(user._id),
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: '验证失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // 登出：清除 cookie
  const response = NextResponse.json({
    success: true,
  });
  
  response.cookies.delete('token');
  
  return response;
}
