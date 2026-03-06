import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';
import { chatWithZhipuStream } from '@/lib/services/zhipu';
import { getCharacterById } from '@/lib/config/characters';

// 聊天模式设定
const modes = {
  treehole: '请只倾听，不要给建议,让用户尽情倾诉。',
  advice: '请分析问题并给出具体可行的建议。',
  companion: '请像朋友一样轻松自然地聊天。',
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const { message, sessionId, mode = 'companion', character = 'gentle', userId } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: '消息不能为空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!userId || userId === 'guest') {
      return new Response(
        JSON.stringify({ success: false, error: '请先登录' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
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

    if (!apiKey || apiKey === 'your_zhipu_api_key_here') {
      return new Response(
        JSON.stringify({ success: false, error: 'AI 服务未配置' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 创建 SSE 流式响应
    const encoder = new TextEncoder();
    let fullReply = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送会话 ID
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: session._id })}\n\n`)
          );

          // 获取智谱流式响应
          const zhipuStream = await chatWithZhipuStream(zhipuMessages, apiKey);
          const reader = zhipuStream.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullReply += chunk;

            // 发送内容块
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`)
            );
          }

          // 保存完整回复到数据库
          session.messages.push({
            role: 'assistant',
            content: fullReply,
            timestamp: new Date(),
          });
          await session.save();

          // 发送完成信号
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          );
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ success: false, error: '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
