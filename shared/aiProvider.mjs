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
    structuredOutputMode: 'responses_json_schema',
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
    structuredOutputMode: 'json_object',
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
    structuredOutputMode: 'chat_json_schema',
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
    structuredOutputMode: 'prompt_only',
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
    apiKeySource: configuredKeyName || definition.apiKeyNames[0],
    missingKeyLabel: definition.apiKeyNames.join(' hoặc '),
    baseURL: baseUrlOverride || definition.baseURL,
  });
}

export function resolveQuizAiProvider(environment = {}) {
  const providerOverride = clean(environment.QUIZ_AI_PROVIDER).toLowerCase();
  const modelOverride = clean(environment.QUIZ_AI_MODEL);
  const genericKeyOverride = clean(environment.QUIZ_AI_API_KEY);
  const requestedName = providerOverride || clean(environment.AI_PROVIDER).toLowerCase() || 'openai';
  const definition = PROVIDERS[Object.hasOwn(PROVIDERS, requestedName) ? requestedName : 'openai'];
  const primaryKeyName = definition.apiKeyNames[0];
  const providerKeyOverride = clean(environment[`QUIZ_${primaryKeyName}`]);
  const configuredProviderKeyName = definition.apiKeyNames.find((name) => clean(environment[name]));
  const configuredProviderKey = configuredProviderKeyName ? clean(environment[configuredProviderKeyName]) : '';
  const baseUrlEnvName = definition.baseUrlEnv;
  const baseUrlOverride = clean(environment.QUIZ_AI_BASE_URL)
    || (baseUrlEnvName ? clean(environment[`QUIZ_${baseUrlEnvName}`]) : '');
  const hasScopedOverride = Boolean(providerOverride || modelOverride || genericKeyOverride || providerKeyOverride || baseUrlOverride);
  if (!hasScopedOverride) return resolveAiProvider(environment);

  const scopedEnvironment = { ...environment, AI_PROVIDER: requestedName };
  if (modelOverride) {
    scopedEnvironment.AI_MODEL = modelOverride;
  } else if (providerOverride) {
    delete scopedEnvironment.AI_MODEL;
    delete scopedEnvironment.OPENAI_MODEL;
  }
  const selectedKey = providerKeyOverride || configuredProviderKey || genericKeyOverride;
  const selectedKeySource = providerKeyOverride
    ? `QUIZ_${primaryKeyName}`
    : configuredProviderKeyName || (genericKeyOverride ? 'QUIZ_AI_API_KEY' : primaryKeyName);
  if (selectedKey) scopedEnvironment[primaryKeyName] = selectedKey;
  if (baseUrlOverride && baseUrlEnvName) scopedEnvironment[baseUrlEnvName] = baseUrlOverride;
  return Object.freeze({ ...resolveAiProvider(scopedEnvironment), apiKeySource: selectedKeySource });
}

export function resolveQuizFallbackAiProvider(environment = {}) {
  const fallbackProvider = clean(environment.QUIZ_AI_FALLBACK_PROVIDER).toLowerCase();
  if (!fallbackProvider) return null;
  const mapped = {
    ...environment,
    QUIZ_AI_PROVIDER: fallbackProvider,
    QUIZ_AI_MODEL: clean(environment.QUIZ_AI_FALLBACK_MODEL),
    QUIZ_AI_API_KEY: clean(environment.QUIZ_AI_FALLBACK_API_KEY),
    QUIZ_AI_BASE_URL: clean(environment.QUIZ_AI_FALLBACK_BASE_URL),
  };
  const resolved = resolveQuizAiProvider(mapped);
  const fallbackKey = clean(environment.QUIZ_AI_FALLBACK_API_KEY);
  return Object.freeze({
    ...resolved,
    apiKey: fallbackKey || resolved.apiKey,
    apiKeySource: fallbackKey ? 'QUIZ_AI_FALLBACK_API_KEY' : resolved.apiKeySource,
  });
}

export function buildChatCompatibilityOptions(provider, maxTokens) {
  if (!provider || provider.protocol !== 'chat') return {};
  const options = ['groq', 'zenmux'].includes(provider.name) ? { reasoning_effort: 'none' } : {};
  if (Number.isInteger(maxTokens) && maxTokens > 0 && provider.maxTokensField) {
    options[provider.maxTokensField] = maxTokens;
  }
  return options;
}
