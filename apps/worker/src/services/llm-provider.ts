import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMOptions, LLMProviderInterface } from '@crypto-news/shared';
import { createLogger, retryWithBackoff } from '@crypto-news/shared';

const logger = createLogger('worker:llm');

// Only retry on rate limits (429) and server errors (5xx).
// Do NOT retry on auth errors (401/403) or client errors — those just waste tokens.
function isRetryableError(error: Error): boolean {
  const message = error.message?.toLowerCase() || '';
  const statusCode = (error as any).status || (error as any).statusCode || 0;

  // Rate limit — always retry
  if (statusCode === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return true;
  }

  // Server errors (5xx) — transient, worth retrying
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Network/timeout errors — transient
  if (message.includes('timeout') || message.includes('econnreset') || message.includes('socket hang up')) {
    return true;
  }

  // Everything else (auth errors, bad requests, format errors) — don't waste tokens
  return false;
}

// OpenAI Provider
export class OpenAIProvider implements LLMProviderInterface {
  name: LLMProvider = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gpt-4-turbo-preview') {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  async complete(prompt: string, options: LLMOptions = {}): Promise<string> {
    const { temperature = 0.3, maxTokens = 1500, model } = options;

    return retryWithBackoff(
      async () => {
        const response = await this.client.chat.completions.create({
          model: model || this.defaultModel,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        return content;
      },
      {
        maxRetries: 1,
        baseDelayMs: 3000,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt) => {
          logger.warn({ error: error.message, attempt }, 'Retrying OpenAI request');
        },
      }
    );
  }
}

// OpenRouter Provider
export class OpenRouterProvider implements LLMProviderInterface {
  name: LLMProvider = 'openrouter';
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'x-ai/grok-4-fast') {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    this.defaultModel = defaultModel;
  }

  async complete(prompt: string, options: LLMOptions = {}): Promise<string> {
    const { temperature = 0.3, maxTokens = 1500, model } = options;

    return retryWithBackoff(
      async () => {
        const response = await this.client.chat.completions.create({
          model: model || this.defaultModel,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenRouter');
        }

        return content;
      },
      {
        maxRetries: 1,
        baseDelayMs: 3000,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt) => {
          logger.warn({ error: error.message, attempt }, 'Retrying OpenRouter request');
        },
      }
    );
  }
}

// Anthropic Provider
export class AnthropicProvider implements LLMProviderInterface {
  name: LLMProvider = 'anthropic';
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'claude-3-sonnet-20240229') {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = defaultModel;
  }

  async complete(prompt: string, options: LLMOptions = {}): Promise<string> {
    const { temperature = 0.3, maxTokens = 1500, model } = options;

    return retryWithBackoff(
      async () => {
        const response = await this.client.completions.create({
          model: model || this.defaultModel,
          max_tokens_to_sample: maxTokens,
          temperature,
          prompt: `${Anthropic.HUMAN_PROMPT} ${prompt}${Anthropic.AI_PROMPT}`,
        });

        const content = response.completion;
        if (!content) {
          throw new Error('Empty response from Anthropic');
        }

        return content;
      },
      {
        maxRetries: 1,
        baseDelayMs: 3000,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt) => {
          logger.warn({ error: error.message, attempt }, 'Retrying Anthropic request');
        },
      }
    );
  }
}

// Factory function
export function createLLMProvider(
  provider: LLMProvider,
  apiKey: string,
  model: string
): LLMProviderInterface {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'openrouter':
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
