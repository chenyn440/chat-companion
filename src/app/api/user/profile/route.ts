import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import User from '@/models/User';
import Session from '@/models/Session';

// 获取用户信息
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
        id: String(user._id),
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}

// 更新用户信息
export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    
    // 从 cookie 验证登录状态
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    
    const { userId, nickname, avatar, preferences } = await req.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }
    
    const updateData: any = {};
    if (nickname !== undefined) updateData.nickname = nickname;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (preferences !== undefined) updateData.preferences = preferences;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).lean();
    
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
    console.error('Update user error:', error);
    return NextResponse.json(
      { success: false, error: '更新用户信息失败' },
      { status: 500 }
    );
  }
}
