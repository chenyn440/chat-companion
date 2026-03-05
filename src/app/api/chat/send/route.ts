import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';
import { chatWithKimi } from '@/lib/services/kimi';

// AI 角色设定
const characters = {
  gentle: {
    name: '温柔知心',
    prompt: '你是一位温柔体贴的倾听者，说话柔和、富有同理心，擅长情感支持和安慰。',
  },
  rational: {
    name: '理性分析',
    prompt: '你是一位理性的分析师，说话简洁明了，擅长逻辑分析和给出实用建议。',
  },
  funny: {
    name: '幽默风趣',
    prompt: '你是一位幽默风趣的朋友，说话轻松有趣，擅长用幽默化解尴尬和烦恼。',
  },
  elder: {
    name: '长辈关怀',
    prompt: '你是一位慈祥的长辈，说话温和有阅历，擅长用人生经验给予指导。',
  },
};

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
    const characterPrompt = characters[character as keyof typeof characters]?.prompt || characters.gentle.prompt;
    const modePrompt = modes[mode as keyof typeof modes] || modes.companion;
    
    const systemPrompt = `${characterPrompt}\n\n当前模式：${modePrompt}\n\n请根据以上设定回复用户。`;

    // 调用 Kimi API
    const kimiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...session.messages.slice(-10).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const apiKey = process.env.KIMI_API_KEY;
    let aiReply: string;

    if (apiKey && apiKey !== 'your_kimi_api_key_here') {
      try {
        aiReply = await chatWithKimi(kimiMessages, apiKey);
      } catch (error: any) {
        console.error('Kimi API error:', error);
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
