import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Session from '@/models/Session';
import { getCharacterById } from '@/lib/config/characters';
import { getModelConfig, PROVIDER_URLS, ReasoningMode } from '@/lib/config/modelRoutes';

const modes = {
  treehole: '请只倾听，不要给建议，让用户尽情倾诉。',
  advice: '请分析问题并给出具体可行的建议。',
  companion: '请像朋友一样轻松自然地聊天。',
};

// 按 provider 获取 API Key
function getApiKey(provider: string): string | undefined {
  if (provider === 'zhipu') return process.env.ZHIPU_API_KEY;
  if (provider === 'groq')  return process.env.GROQ_API_KEY;
  return undefined;
}

// 将错误状态码映射为用户友好提示
function mapHttpError(status: number, provider: string): string {
  if (status === 401 || status === 403) return `${provider} API Key 无效或无权限`;
  if (status === 429) return '请求过于频繁，请稍后再试（或深度思考配额已用完）';
  if (status >= 500) return `${provider} 服务暂时不可用，请稍后重试`;
  return `AI 服务错误 (${status})`;
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const {
      message,
      sessionId,
      mode = 'companion',
      character = 'gentle',
      userId,
      reasoningMode = 'normal',  // 新增：'normal' | 'deep'
    } = await req.json();

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

    // 路由配置
    const modelConfig = getModelConfig(reasoningMode as ReasoningMode);
    const apiKey = getApiKey(modelConfig.provider);
    const apiUrl = PROVIDER_URLS[modelConfig.provider];

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: reasoningMode === 'deep'
          ? '深度思考服务未配置（需要 GROQ_API_KEY）'
          : 'AI 服务未配置',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`[chat] provider=${modelConfig.provider} model=${modelConfig.model} mode=${reasoningMode}`);

    // 获取或创建会话
    let session: any;
    if (sessionId && /^[0-9a-fA-F]{24}$/.test(sessionId)) {
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

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...session.messages.slice(-10).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // 调用 AI API
    const aiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: modelConfig.limits.maxTokens,
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`${modelConfig.provider} API error ${aiRes.status}:`, errText);
      return new Response(JSON.stringify({
        success: false,
        error: mapHttpError(aiRes.status, modelConfig.provider),
        errorCode: aiRes.status,
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    if (!aiRes.body) {
      return new Response(JSON.stringify({ success: false, error: 'AI 响应体为空' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessionDbId = session._id;
    const encoder = new TextEncoder();

    const transformStream = new TransformStream({
      start(ctrl) {
        ctrl.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'session',
            sessionId: sessionDbId,
            reasoningMode,            // 告知前端本次用的什么模式
            model: modelConfig.model,
          })}\n\n`)
        );
      },
    });

    let fullReply = '';
    (async () => {
      const writer = transformStream.writable.getWriter();
      const reader = aiRes.body!.getReader();
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
              const delta = chunk.choices?.[0]?.delta;

              // DeepSeek R1 会有 reasoning_content 字段（思维链），P0 不展示
              // 只取 content 部分
              const content: string = delta?.content ?? '';
              if (content) {
                fullReply += content;
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`)
                );
              }

              if (chunk.choices?.[0]?.finish_reason === 'stop') break;
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

        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      } catch (err: any) {
        console.error('Stream processing error:', err);
        try {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
          );
        } catch { /* client disconnected */ }
      } finally {
        try { await writer.close(); } catch { /* already closed */ }
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
