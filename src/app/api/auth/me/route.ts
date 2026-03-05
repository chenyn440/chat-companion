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

    // TODO: 验证 token 并获取用户信息
    // MVP 阶段简化处理：token 包含用户ID
    
    return NextResponse.json({
      success: true,
      data: {
        isLoggedIn: true,
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
