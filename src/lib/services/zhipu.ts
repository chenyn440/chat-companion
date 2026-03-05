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

export async function chatWithZhipu(
  messages: ZhipuMessage[],
  apiKey: string
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

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
