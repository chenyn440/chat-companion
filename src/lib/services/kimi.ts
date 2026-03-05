// Kimi API 服务
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';

interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface KimiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function chatWithKimi(
  messages: KimiMessage[],
  apiKey: string
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API error: ${error}`);
    }

    const data: KimiResponse = await response.json();
    return data.choices[0]?.message?.content || '抱歉，我没有理解你的意思。';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Kimi API 请求超时');
    }
    console.error('Kimi API error:', error);
    throw error;
  }
}
