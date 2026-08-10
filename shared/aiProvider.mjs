const PROVIDERS = Object.freeze({
  openai: Object.freeze({
    name: 'openai',
    label: 'OpenAI',
    protocol: 'responses',
    defaultModel: 'gpt-5.6-sol',
    apiKeyNames: Object.freeze(['OPENAI_API_KEY']),
    baseURL: undefined,
    baseUrlEnv: undefined,
    maxTokensField: undefined,
    supportsJsonObject: true,
  }),
  groq: Object.freeze({
    name: 'groq',
    label: 'Groq',
    protocol: 'chat',
    defaultModel: 'qwen/qwen3.6-27b',
    apiKeyNames: Object.freeze(['GROQ_API_KEY']),
    baseURL: 'https://api.groq.com/openai/v1',
    baseUrlEnv: 'GROQ_BASE_URL',
    maxTokensField: 'max_completion_tokens',
    supportsJsonObject: true,
  }),
  zenmux: Object.freeze({
    name: 'zenmux',
    label: 'ZenMux',
    protocol: 'chat',
    defaultModel: 'z-ai/glm-4.6v-flash-free',
    apiKeyNames: Object.freeze(['ZENMUX_API_KEY', 'GLM_API_KEY']),
    baseURL: 'https://zenmux.ai/api/v1',
    baseUrlEnv: 'ZENMUX_BASE_URL',
    maxTokensField: 'max_completion_tokens',
    supportsJsonObject: true,
  }),
  kira: Object.freeze({
    name: 'kira',
    label: 'Kira',
    protocol: 'chat',
    defaultModel: 'kira-mini-1.0',
    apiKeyNames: Object.freeze(['KIRA_API_KEY']),
    baseURL: 'https://kiraai.vn/api/v1',
    baseUrlEnv: 'KIRA_BASE_URL',
    maxTokensField: 'max_tokens',
    supportsJsonObject: false,
  }),
});

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export const supportedAiProviders = Object.freeze(Object.keys(PROVIDERS));

export function resolveAiProvider(environment = {}) {
  const requestedName = clean(environment.AI_PROVIDER).toLowerCase() || 'openai';
  const recognized = Object.hasOwn(PROVIDERS, requestedName);
  const definition = PROVIDERS[recognized ? requestedName : 'openai'];
  const configuredKeyName = definition.apiKeyNames.find((name) => clean(environment[name]));
  const baseUrlOverride = definition.baseUrlEnv ? clean(environment[definition.baseUrlEnv]) : '';
  const providerModel = clean(environment.AI_MODEL)
    || clean(environment.OPENAI_MODEL)
    || definition.defaultModel;

  return Object.freeze({
    ...definition,
    requestedName,
    recognized,
    model: providerModel,
    apiKey: configuredKeyName ? clean(environment[configuredKeyName]) : '',
    apiKeyName: configuredKeyName || definition.apiKeyNames[0],
    missingKeyLabel: definition.apiKeyNames.join(' hoặc '),
    baseURL: baseUrlOverride || definition.baseURL,
  });
}

export function buildChatCompatibilityOptions(provider, maxTokens) {
  if (!provider || provider.protocol !== 'chat') return {};
  const options = provider.name === 'groq' ? { reasoning_effort: 'none' } : {};
  if (Number.isInteger(maxTokens) && maxTokens > 0 && provider.maxTokensField) {
    options[provider.maxTokensField] = maxTokens;
  }
  return options;
}
