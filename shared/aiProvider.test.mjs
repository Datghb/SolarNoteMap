import { describe, expect, it } from 'vitest';
import { buildChatCompatibilityOptions, resolveAiProvider, resolveQuizAiProvider, supportedAiProviders } from './aiProvider.mjs';

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

  it('keeps quiz generation on the main provider when no scoped override exists', () => {
    expect(resolveQuizAiProvider({ AI_PROVIDER: 'groq', AI_MODEL: 'main-model', GROQ_API_KEY: 'main-key' })).toMatchObject({
      name: 'groq', model: 'main-model', apiKey: 'main-key',
    });
  });

  it('separates quiz provider, model and key from the knowledge graph provider', () => {
    const environment = {
      AI_PROVIDER: 'groq', AI_MODEL: 'graph-model', GROQ_API_KEY: 'graph-key',
      QUIZ_AI_PROVIDER: 'kira', QUIZ_AI_API_KEY: 'quiz-key',
    };
    expect(resolveAiProvider(environment)).toMatchObject({ name: 'groq', model: 'graph-model', apiKey: 'graph-key' });
    expect(resolveQuizAiProvider(environment)).toMatchObject({ name: 'kira', model: 'kira-mini-1.0', apiKey: 'quiz-key' });
  });

  it('supports a quiz-specific model, provider key and base URL', () => {
    expect(resolveQuizAiProvider({
      AI_PROVIDER: 'groq', GROQ_API_KEY: 'main-key',
      QUIZ_AI_PROVIDER: 'zenmux', QUIZ_AI_MODEL: 'quiz-model', QUIZ_ZENMUX_API_KEY: 'zen-quiz-key', QUIZ_AI_BASE_URL: 'https://quiz.example/v1',
    })).toMatchObject({ name: 'zenmux', model: 'quiz-model', apiKey: 'zen-quiz-key', baseURL: 'https://quiz.example/v1' });
  });
});
