import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Topic from '@/models/Topic';

// 获取话题列表
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const query: any = { isActive: true };
    if (category && category !== 'all') {
      query.category = category;
    }

    const topics = await Topic.find(query)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: { topics },
    });
  } catch (error) {
    console.error('Get topics error:', error);
    return NextResponse.json(
      { success: false, error: '获取话题失败' },
      { status: 500 }
    );
  }
}

// 初始化话题数据（仅用于开发）
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const defaultTopics = [
      {
        title: '今天最开心的事',
        description: '分享一件今天让你感到快乐的小事',
        category: 'emotion',
        tags: ['快乐', '分享'],
      },
      {
        title: '工作压力怎么缓解',
        description: '聊聊你工作中的压力，以及如何放松自己',
        category: 'work',
        tags: ['压力', '放松'],
      },
      {
        title: '最近在读什么书',
        description: '分享你最近阅读的书籍和心得',
        category: 'interest',
        tags: ['阅读', '书籍'],
      },
      {
        title: '周末计划做什么',
        description: '聊聊你的周末安排和期待',
        category: 'life',
        tags: ['周末', '计划'],
      },
      {
        title: '如何处理人际关系',
        description: '探讨人际关系中的困惑和解决方法',
        category: 'emotion',
        tags: ['人际关系', '社交'],
      },
      {
        title: '职业规划思考',
        description: '聊聊你的职业发展目标和规划',
        category: 'work',
        tags: ['职业', '规划'],
      },
    ];

    await Topic.insertMany(defaultTopics);

    return NextResponse.json({
      success: true,
      message: '话题数据初始化成功',
    });
  } catch (error) {
    console.error('Init topics error:', error);
    return NextResponse.json(
      { success: false, error: '初始化话题失败' },
      { status: 500 }
    );
  }
}
