import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';
import { chatWithZhipu } from '@/lib/services/zhipu';
import { getCharacterById } from '@/lib/config/characters';

// 聊天模式设定
const modes = {
  treehole: '请只倾听，不要给建议，让用户尽情倾诉。',
  advice: '请分析问题并给出具体可行的建议。',
  companion: '请像朋友一样轻松自然地聊天。',
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const { message, sessionId, mode = 'companion', character = 'gentle', userId } = await req.json();

    if (!message) {
      return NextResponse.json({ success: false, error: '消息不能为空' }, { status: 400 });
    }

    if (!userId || userId === 'guest') {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    // 获取或创建会话
    let session;
    if (sessionId) {
      session = await Session.findById(sessionId);
    }

    if (!session) {
      session = new Session({
        userId,
        mode,
        character,
        messages: [],
      });
    }

    // 添加用户消息
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // 构建 AI 提示词
    const characterConfig = getCharacterById(character);
    const modePrompt = modes[mode as keyof typeof modes] || modes.companion;
    
    const systemPrompt = `${characterConfig.prompt}\n\n当前模式：${modePrompt}\n\n请根据以上设定回复用户。`;

    // 调用智谱 API
    const zhipuMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...session.messages.slice(-10).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const apiKey = process.env.ZHIPU_API_KEY;
    let aiReply: string;

    if (apiKey && apiKey !== 'your_zhipu_api_key_here') {
      try {
        aiReply = await chatWithZhipu(zhipuMessages, apiKey);
      } catch (error: any) {
        console.error('Zhipu API error:', error);
        aiReply = '抱歉，AI 服务暂时不可用，请稍后再试。';
      }
    } else {
      aiReply = '抱歉，AI 服务未配置。';
    }

    // 添加 AI 回复
    session.messages.push({
      role: 'assistant',
      content: aiReply,
      timestamp: new Date(),
    });

    // 保存到数据库
    await session.save();

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session._id,
        aiReply,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
