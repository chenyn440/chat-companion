import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Mood from '@/models/Mood';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const moods = await Mood.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 }).lean();

    // 统计各心情类型数量
    const moodCounts: Record<string, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      anxious: 0,
      neutral: 0,
    };
    
    moods.forEach((m) => {
      if (moodCounts[m.mood] !== undefined) {
        moodCounts[m.mood]++;
      }
    });

    // 计算心情趋势数据
    const trendData = moods.map((m) => ({
      date: m.date.toISOString().split('T')[0],
      mood: m.mood,
      value: getMoodValue(m.mood),
    }));

    return NextResponse.json({
      success: true,
      data: {
        total: moods.length,
        moodCounts,
        trendData,
        period: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error('Get mood stats error:', error);
    return NextResponse.json(
      { success: false, error: '获取心情统计失败' },
      { status: 500 }
    );
  }
}

// 将心情转换为数值（用于趋势图）
function getMoodValue(mood: string): number {
  const values: Record<string, number> = {
    happy: 5,
    neutral: 3,
    anxious: 2,
    sad: 2,
    angry: 1,
  };
  return values[mood] || 3;
}
