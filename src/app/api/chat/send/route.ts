import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';
import { getCharacterById } from '@/lib/config/characters';

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

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
      return new Response(JSON.stringify({ success: false, error: '消息不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!userId || userId === 'guest') {
      return new Response(JSON.stringify({ success: false, error: '请先登录' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey || apiKey === 'your_zhipu_api_key_here') {
      return new Response(JSON.stringify({ success: false, error: 'AI 服务未配置' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取或创建会话
    let session: any;
    if (sessionId) {
      session = await Session.findById(sessionId);
    }
    if (!session) {
      session = new Session({ userId, mode, character, messages: [] });
    }

    session.messages.push({ role: 'user', content: message, timestamp: new Date() });

    // 构建提示词
    const characterConfig = getCharacterById(character);
    const modePrompt = modes[mode as keyof typeof modes] || modes.companion;
    const systemPrompt = `${characterConfig.prompt}\n\n当前模式：${modePrompt}\n\n请根据以上设定回复用户。`;

    const zhipuMessages = [
      { role: 'system', content: systemPrompt },
      ...session.messages.slice(-10).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // 直接调用智谱 API，拿到原始流
    const zhipuRes = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: zhipuMessages,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!zhipuRes.ok) {
      const errText = await zhipuRes.text();
      console.error('Zhipu API error:', errText);
      return new Response(JSON.stringify({ success: false, error: `AI 服务错误: ${zhipuRes.status}` }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!zhipuRes.body) {
      return new Response(JSON.stringify({ success: false, error: 'AI 响应体为空' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionDbId = session._id;
    const encoder = new TextEncoder();

    // 创建转换流：把智谱原始 SSE → 我们自己的 SSE 格式
    const transformStream = new TransformStream({
      start(ctrl) {
        // 先发 session 事件
        ctrl.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: sessionDbId })}\n\n`)
        );
      },
    });

    // 用一个 async 任务处理转换，不阻塞响应返回
    let fullReply = '';
    (async () => {
      const writer = transformStream.writable.getWriter();
      const reader = zhipuRes.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const raw = t.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const chunk = JSON.parse(raw);
              const content: string = chunk.choices?.[0]?.delta?.content ?? '';
              if (content) {
                fullReply += content;
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`)
                );
              }
              // finish_reason === 'stop' 代表结束
              if (chunk.choices?.[0]?.finish_reason === 'stop') {
                break;
              }
            } catch {
              // 单行解析失败，跳过
            }
          }
        }

        // 保存到数据库
        try {
          session.messages.push({ role: 'assistant', content: fullReply, timestamp: new Date() });
          await session.save();
        } catch (dbErr) {
          console.error('DB save error:', dbErr);
        }

        // 发 done 事件
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      } catch (err: any) {
        console.error('Stream processing error:', err);
        try {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
          );
        } catch { /* 写入失败（客户端断开），忽略 */ }
      } finally {
        try { await writer.close(); } catch { /* 已关闭，忽略 */ }
      }
    })();

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (error: any) {
    console.error('Chat route error:', error);
    return new Response(JSON.stringify({ success: false, error: '服务器错误' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
