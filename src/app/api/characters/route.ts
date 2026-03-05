import { NextResponse } from 'next/server';

// AI 角色设定
const characters = [
  {
    _id: 'gentle',
    name: '温柔知心',
    avatar: '🌸',
    greeting: '你好呀，今天想聊点什么呢？我在这里倾听你。',
  },
  {
    _id: 'rational',
    name: '理性分析',
    avatar: '🧠',
    greeting: '你好，有什么问题需要我帮你分析吗？',
  },
  {
    _id: 'funny',
    name: '幽默风趣',
    avatar: '😄',
    greeting: '嘿！今天过得怎么样？来聊点开心的！',
  },
  {
    _id: 'elder',
    name: '长辈关怀',
    avatar: '👴',
    greeting: '孩子，最近怎么样？有什么想跟长辈聊聊的吗？',
  },
];

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      characters,
    });
  } catch (error) {
    console.error('Get characters error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
