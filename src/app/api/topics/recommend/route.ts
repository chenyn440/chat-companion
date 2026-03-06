import { NextRequest, NextResponse } from 'next/server';

// 话题库（带角色和心情标签）
const TOPICS = [
  // 情感类
  { id: 't1', title: '最近让你开心的一件事', category: 'emotion', tags: ['happy', 'gentle', 'elder'], mood: ['happy', 'neutral'] },
  { id: 't2', title: '有什么烦恼想倾诉吗', category: 'emotion', tags: ['gentle', 'elder'], mood: ['sad', 'anxious', 'angry'] },
  { id: 't3', title: '最近有没有让你感动的瞬间', category: 'emotion', tags: ['gentle', 'elder'], mood: ['happy', 'neutral'] },
  { id: 't4', title: '如何处理人际关系中的矛盾', category: 'emotion', tags: ['rational', 'elder'], mood: ['anxious', 'angry'] },
  { id: 't5', title: '你最近有没有感到孤独', category: 'emotion', tags: ['gentle'], mood: ['sad', 'neutral'] },
  // 工作类
  { id: 't6', title: '工作压力怎么缓解', category: 'work', tags: ['rational', 'funny'], mood: ['anxious', 'angry'] },
  { id: 't7', title: '职业规划有什么困惑', category: 'work', tags: ['rational', 'elder'], mood: ['anxious', 'neutral'] },
  { id: 't8', title: '如何提升工作效率', category: 'work', tags: ['rational'], mood: ['neutral', 'happy'] },
  { id: 't9', title: '和同事相处有什么技巧', category: 'work', tags: ['rational', 'funny', 'elder'], mood: ['anxious', 'neutral'] },
  // 生活类
  { id: 't10', title: '周末计划做什么', category: 'life', tags: ['funny', 'gentle'], mood: ['happy', 'neutral'] },
  { id: 't11', title: '最近有什么新发现', category: 'life', tags: ['funny', 'rational'], mood: ['happy', 'neutral'] },
  { id: 't12', title: '你有什么生活小习惯', category: 'life', tags: ['gentle', 'elder'], mood: ['neutral', 'happy'] },
  // 兴趣类
  { id: 't13', title: '最近在读什么书', category: 'hobby', tags: ['rational', 'elder'], mood: ['neutral', 'happy'] },
  { id: 't14', title: '有什么想学的新技能', category: 'hobby', tags: ['rational', 'funny'], mood: ['neutral', 'happy'] },
  { id: 't15', title: '最喜欢的电影或剧集', category: 'hobby', tags: ['funny', 'gentle'], mood: ['happy', 'neutral', 'sad'] },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const character = searchParams.get('character') || 'gentle';
    const mood = searchParams.get('mood') || '';
    const limit = parseInt(searchParams.get('limit') || '6');

    // 计算每个话题的推荐分数
    const scored = TOPICS.map(topic => {
      let score = 0;
      // 角色匹配加分
      if (topic.tags.includes(character)) score += 2;
      // 心情匹配加分
      if (mood && topic.mood.includes(mood)) score += 3;
      return { ...topic, score };
    });

    // 按分数排序，取前 limit 条
    const recommended = scored
      .sort((a, b) => b.score - a.score || Math.random() - 0.5)
      .slice(0, limit)
      .map(({ id, title, category }) => ({ id, title, category }));

    return NextResponse.json({
      success: true,
      data: { topics: recommended },
    });
  } catch (error) {
    console.error('Recommend topics error:', error);
    return NextResponse.json(
      { success: false, error: '获取推荐话题失败' },
      { status: 500 }
    );
  }
}
