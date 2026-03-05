import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    
    if (!phone) {
      return NextResponse.json(
        { success: false, error: '手机号不能为空' },
        { status: 400 }
      );
    }

    // MVP 阶段：验证码固定为 123456，直接返回成功
    // 实际项目中这里应该调用短信服务发送验证码
    console.log(`Send code to ${phone}: 123456`);

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
    });
  } catch (error) {
    console.error('Send code error:', error);
    return NextResponse.json(
      { success: false, error: '发送验证码失败' },
      { status: 500 }
    );
  }
}
