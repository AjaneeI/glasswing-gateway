import type { LlmConfig } from './client';

export interface ProviderInfo {
  id: string;
  label: string;
  description: string;
  model: string;
  configured: boolean;
}

interface ProviderSpec {
  id: string;
  label: string;
  description: string;
  baseUrlEnv: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultBaseUrl?: string;
  defaultModel: string;
}

const specs: ProviderSpec[] = [
  {
    id: 'sciforium',
    label: 'Sciforium',
    description: 'Hosted Sciforium deployment (OpenAI-compatible).',
    baseUrlEnv: 'SCIFORIUM_BASE_URL',
    apiKeyEnv: 'SCIFORIUM_API_KEY',
    modelEnv: 'SCIFORIUM_MODEL',
    defaultModel: 'sciforium//deployments/506a9a37/deepseek-ai/DeepSeek-V4.1-Flash',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'OpenAI platform models (gpt-4o, gpt-4o-mini).',
    baseUrlEnv: 'OPENAI_BASE_URL',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'custom',
    label: 'Custom endpoint',
    description: 'Any OpenAI-compatible endpoint (Groq, Together, vLLM, Ollama).',
    baseUrlEnv: 'CUSTOM_LLM_BASE_URL',
    apiKeyEnv: 'CUSTOM_LLM_API_KEY',
    modelEnv: 'CUSTOM_LLM_MODEL',
    defaultModel: 'llama-3.1-70b',
  },
];

export const defaultProviderId = 'sciforium';

export function resolveProvider(id?: string): LlmConfig | null {
  const spec = specs.find((item) => item.id === (id || defaultProviderId));
  if (!spec) return null;
  const baseUrl = process.env[spec.baseUrlEnv] || spec.defaultBaseUrl;
  const apiKey = process.env[spec.apiKeyEnv];
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model: process.env[spec.modelEnv] || spec.defaultModel,
  };
}

export function listProviders(): ProviderInfo[] {
  return specs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    description: spec.description,
    model: process.env[spec.modelEnv] || spec.defaultModel,
    configured: Boolean(resolveProvider(spec.id)),
  }));
}