// 智谱 AI API 服务
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

interface ZhipuMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ZhipuResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ZhipuStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

// 非流式调用（保留兼容）
export async function chatWithZhipu(
  messages: ZhipuMessage[],
  apiKey: string
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zhipu API error: ${error}`);
    }

    const data: ZhipuResponse = await response.json();
    return data.choices[0]?.message?.content || '抱歉，我没有理解你的意思。';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('智谱 API 请求超时');
    }
    console.error('Zhipu API error:', error);
    throw error;
  }
}

// 流式调用
export async function chatWithZhipuStream(
  messages: ZhipuMessage[],
  apiKey: string
): Promise<ReadableStream> {
  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages,
      temperature: 0.7,
      stream: true, // 开启流式返回
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zhipu API error: ${error}`);
  }

  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        controller.close();
        return;
      }

      let buffer = ''; // 缓冲区，处理跨 chunk 的数据

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 将新数据追加到缓冲区
          buffer += decoder.decode(value, { stream: true });
          
          // 按行分割，保留最后一个不完整的行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed: ZhipuStreamChunk = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch (e) {
                console.error('Parse error:', e, 'Raw data:', data);
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });
}
