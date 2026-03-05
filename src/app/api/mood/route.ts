import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Mood from '@/models/Mood';

// 获取心情记录列表
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    const query: any = { userId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const moods = await Mood.find(query)
      .sort({ date: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: { moods },
    });
  } catch (error) {
    console.error('Get moods error:', error);
    return NextResponse.json(
      { success: false, error: '获取心情记录失败' },
      { status: 500 }
    );
  }
}

// 创建或更新心情记录
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, mood, content, date } = await req.json();
    
    if (!userId || !mood) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const recordDate = date ? new Date(date) : new Date();
    recordDate.setHours(0, 0, 0, 0);

    // 查找或创建记录
    const moodRecord = await Mood.findOneAndUpdate(
      { userId, date: recordDate },
      { mood, content },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      data: { mood: moodRecord },
    });
  } catch (error) {
    console.error('Create mood error:', error);
    return NextResponse.json(
      { success: false, error: '保存心情记录失败' },
      { status: 500 }
    );
  }
}
