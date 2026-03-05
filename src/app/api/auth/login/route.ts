import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import User from '@/models/User';
import crypto from 'crypto';

// 简单的 token 生成
function generateToken(userId: string): string {
  return crypto.createHmac('sha256', 'secret-key').update(userId + Date.now()).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const { phone, code } = await req.json();
    
    if (!phone || !code) {
      return NextResponse.json(
        { success: false, error: '手机号和验证码不能为空' },
        { status: 400 }
      );
    }

    // MVP 阶段：验证码固定为 123456
    if (code !== '123456') {
      return NextResponse.json(
        { success: false, error: '验证码错误' },
        { status: 400 }
      );
    }

    // 查找或创建用户
    let user = await User.findOne({ phone });
    
    if (!user) {
      user = new User({
        phone,
        nickname: `用户${phone.slice(-4)}`,
      });
      await user.save();
    }

    // 生成 token
    const token = generateToken(user._id.toString());

    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          preferences: user.preferences,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '登录失败' },
      { status: 500 }
    );
  }
}
