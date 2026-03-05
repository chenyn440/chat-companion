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
    
    // 从 header 获取 userId（前端从 localStorage 传入）
    const userId = req.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }
    
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
        user: {
          id: String(user._id),
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          preferences: user.preferences,
        },
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { success: false, error: '验证失败' },
      { status: 500 }
    );
  }
}

// 退出登录 - 清除 cookie
export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: '已退出登录',
    });
    
    // 清除 cookie
    response.cookies.delete('token');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: '退出登录失败' },
      { status: 500 }
    );
  }
}
