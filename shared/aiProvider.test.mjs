import { describe, expect, it } from 'vitest';
import { buildChatCompatibilityOptions, resolveAiProvider, supportedAiProviders } from './aiProvider.mjs';

describe('AI provider configuration', () => {
  it('keeps the existing OpenAI default for an unset or unknown provider', () => {
    expect(resolveAiProvider({ OPENAI_API_KEY: 'openai-key' })).toMatchObject({
      name: 'openai', protocol: 'responses', model: 'gpt-5.6-sol', apiKey: 'openai-key', recognized: true,
    });
    expect(resolveAiProvider({ AI_PROVIDER: 'typo', OPENAI_API_KEY: 'openai-key' })).toMatchObject({
      name: 'openai', requestedName: 'typo', recognized: false,
    });
  });

  it('resolves Groq without changing its working defaults', () => {
    const provider = resolveAiProvider({ AI_PROVIDER: 'groq', GROQ_API_KEY: 'groq-key' });
    expect(provider).toMatchObject({
      name: 'groq', protocol: 'chat', model: 'qwen/qwen3.6-27b',
      apiKey: 'groq-key', baseURL: 'https://api.groq.com/openai/v1',
    });
    expect(buildChatCompatibilityOptions(provider, 900)).toEqual({
      reasoning_effort: 'none', max_completion_tokens: 900,
    });
  });

  it('supports ZenMux with the preferred key and the GLM_API_KEY alias', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'zenmux', ZENMUX_API_KEY: 'zen-key' })).toMatchObject({
      name: 'zenmux', protocol: 'chat', model: 'z-ai/glm-4.6v-flash-free',
      apiKey: 'zen-key', baseURL: 'https://zenmux.ai/api/v1',
    });
    expect(resolveAiProvider({ AI_PROVIDER: 'zenmux', GLM_API_KEY: 'legacy-key' })).toMatchObject({
      apiKey: 'legacy-key', apiKeyName: 'GLM_API_KEY',
    });
  });

  it('supports Kira and provider-specific model/base URL overrides', () => {
    const provider = resolveAiProvider({
      AI_PROVIDER: 'kira', AI_MODEL: 'custom-kira', KIRA_API_KEY: 'kira-key', KIRA_BASE_URL: 'https://example.test/v1',
    });
    expect(provider).toMatchObject({
      name: 'kira', protocol: 'chat', model: 'custom-kira', apiKey: 'kira-key', baseURL: 'https://example.test/v1',
    });
    expect(buildChatCompatibilityOptions(provider, 500)).toEqual({ max_tokens: 500 });
  });

  it('lists every supported provider', () => {
    expect(supportedAiProviders).toEqual(['openai', 'groq', 'zenmux', 'kira']);
  });
});
