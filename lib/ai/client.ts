import { reserveModelCall, executionSignal } from '../gateway/budget';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface CompletionChoice {
  message: ChatMessage;
  finish_reason: string;
}

interface CompletionResponse {
  choices?: CompletionChoice[];
  error?: { message?: string };
}

export async function chatWithTools(
  config: LlmConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  options: { temperature?: number } = {},
): Promise<ChatMessage> {
  const body = JSON.stringify({
    model: config.model,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: options.temperature ?? 0.2,
    max_tokens: 6000,
  });
  await reserveModelCall(config.model, body, 6000);
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    signal: AbortSignal.any([executionSignal(), AbortSignal.timeout(40_000)]),
    body,
  });
  const payload = (await response.json()) as CompletionResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `LLM request failed with status ${response.status}`);
  }
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error('LLM returned no message');
  return message;
}
