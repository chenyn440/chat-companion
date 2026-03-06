// 模型路由配置 - 可按环境/模式切换，尽量低成本

export type CostTier = 'low' | 'standard' | 'premium';
export type ReasoningMode = 'normal' | 'deep';

export interface ModelConfig {
  provider: 'zhipu' | 'groq';
  model: string;
  mode: ReasoningMode;
  costTier: CostTier;
  envAllow: ('dev' | 'staging' | 'prod')[];
  limits: {
    timeoutMs: number;
    maxRetries: number;
    maxTokens: number;
  };
  fallback?: ReasoningMode; // 失败时降级到哪个 mode（undefined = 不自动降级）
}

export const MODEL_ROUTES: Record<ReasoningMode, ModelConfig> = {
  normal: {
    provider: 'zhipu',
    model: 'glm-4-flash',
    mode: 'normal',
    costTier: 'low',
    envAllow: ['dev', 'staging', 'prod'],
    limits: { timeoutMs: 30000, maxRetries: 1, maxTokens: 2048 },
  },
  deep: {
    provider: 'groq',
    model: 'deepseek-r1-distill-llama-70b',
    mode: 'deep',
    costTier: 'low', // Groq 免费层
    envAllow: ['dev', 'staging', 'prod'],
    limits: { timeoutMs: 60000, maxRetries: 1, maxTokens: 4096 },
    // fallback: 'normal',  // 暂不自动降级，避免用户困惑
  },
};

export function getModelConfig(mode: ReasoningMode = 'normal'): ModelConfig {
  return MODEL_ROUTES[mode] ?? MODEL_ROUTES.normal;
}

// 各 provider 的 API base URL
export const PROVIDER_URLS: Record<string, string> = {
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  groq:  'https://api.groq.com/openai/v1/chat/completions',
};
