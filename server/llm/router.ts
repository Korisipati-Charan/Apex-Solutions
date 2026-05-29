import { traceable } from "langsmith/traceable";
import {
  computeCacheKey,
  getCachedResponse,
  setCachedResponse,
} from "./cache.ts";
import { callWithRetry } from "./concurrency.ts";
import { getFailoverChain } from "./failover.ts";
import {
  callAnthropicProvider,
  callGeminiProvider,
  callOpenAICompatibleProvider,
  callOpenAIProvider,
  callSarvamProvider,
  resolveProvider,
  type ProviderKind,
} from "./providers.ts";

import type { ApiConfig } from "../../shared/apiContract.ts";

export type { ApiConfig };

interface ExecutionProfile {
  requestedModel: string;
  provider: ProviderKind;
  executionModel: string;
  cacheIdentity: string;
  baseUrl?: string;
  apiKey?: string;
  compressSystemForLocal?: boolean;
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasConfiguredProvider(modelName: string, apiConfig?: ApiConfig): boolean {
  try {
    resolveExecutionProfile(modelName, apiConfig);
    return true;
  } catch {
    return false;
  }
}

function requireValue(value: string, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function resolveExecutionProfile(requestedModel: string, apiConfig?: ApiConfig): ExecutionProfile {
  const modelName = requestedModel || "gemini-3.5-flash";
  const provider = resolveProvider(modelName);

  const geminiApiKey = trim(apiConfig?.geminiApiKey) || trim(process.env.GEMINI_API_KEY);
  const openaiApiKey = trim(apiConfig?.openaiApiKey) || trim(process.env.OPENAI_API_KEY);
  const anthropicApiKey =
    trim(apiConfig?.anthropicApiKey) || trim(process.env.ANTHROPIC_API_KEY);
  const sarvamApiKey = trim(apiConfig?.sarvamApiKey) || trim(process.env.SARVAM_API_KEY);

  if (provider === "gemini") {
    return {
      requestedModel: modelName,
      provider,
      executionModel:
        trim(apiConfig?.geminiModel) || trim(process.env.GEMINI_MODEL) || modelName,
      apiKey: requireValue(
        geminiApiKey,
        "Configuration Error: Gemini API key is not configured for the selected Gemini model."
      ),
      cacheIdentity: "",
    };
  }

  if (provider === "openai") {
    return {
      requestedModel: modelName,
      provider,
      executionModel:
        trim(apiConfig?.openaiModel) || trim(process.env.OPENAI_MODEL) || "gpt-4o",
      apiKey: requireValue(
        openaiApiKey,
        "Configuration Error: OpenAI API key is not configured for the selected OpenAI model."
      ),
      cacheIdentity: "",
    };
  }

  if (provider === "anthropic") {
    return {
      requestedModel: modelName,
      provider,
      executionModel:
        trim(apiConfig?.anthropicModel) ||
        trim(process.env.ANTHROPIC_MODEL) ||
        "claude-3-5-sonnet-20241022",
      apiKey: requireValue(
        anthropicApiKey,
        "Configuration Error: Anthropic API key is not configured for the selected Claude model."
      ),
      cacheIdentity: "",
    };
  }

  if (provider === "sarvam") {
    return {
      requestedModel: modelName,
      provider,
      executionModel:
        trim(apiConfig?.sarvamModel) || trim(process.env.SARVAM_MODEL) || "sarvam-2b-instruct",
      apiKey: requireValue(
        sarvamApiKey,
        "Configuration Error: Sarvam AI API key is not configured for the selected Sarvam model."
      ),
      cacheIdentity: "",
    };
  }

  if (provider === "local-llm") {
    const baseUrl =
      trim(apiConfig?.localLlmUrl) ||
      trim(process.env.LOCAL_LLM_URL) ||
      "http://localhost:11434/v1";
    const executionModel = trim(apiConfig?.localLlmModel) || trim(process.env.LOCAL_LLM_MODEL);
    return {
      requestedModel: modelName,
      provider,
      executionModel: requireValue(
        executionModel,
        "Configuration Error: Local LLM model identifier is not configured. Enter the exact installed model name, such as an Ollama model shown by `ollama list`."
      ),
      baseUrl,
      compressSystemForLocal: true,
      cacheIdentity: "",
    };
  }

  const baseUrl =
    trim(apiConfig?.otherLlmUrl) || trim(process.env.OTHER_LLM_URL) || "https://api.openai.com/v1";
  const executionModel = trim(apiConfig?.otherLlmModel) || trim(process.env.OTHER_LLM_MODEL);
  const apiKey = trim(apiConfig?.otherLlmApiKey) || trim(process.env.OTHER_LLM_API_KEY);
  if (/api\.openai\.com/i.test(baseUrl) && !apiKey) {
    throw new Error(
      "Configuration Error: Custom endpoint points to OpenAI but no custom API access token was provided."
    );
  }

  return {
    requestedModel: modelName,
    provider,
    executionModel: requireValue(
      executionModel,
      "Configuration Error: Custom LLM model identifier is not configured."
    ),
    baseUrl,
    apiKey: apiKey || undefined,
    cacheIdentity: "",
  };
}

function withCacheIdentity(profile: ExecutionProfile): ExecutionProfile {
  const cacheIdentity = JSON.stringify({
    provider: profile.provider,
    requestedModel: profile.requestedModel,
    executionModel: profile.executionModel,
    baseUrl: profile.baseUrl || null,
  });
  return { ...profile, cacheIdentity };
}

function isTerminalRoutingError(error: Error): boolean {
  return /Configuration Error|401|403|404|not[_ ]found|model .*not found|invalid model|api key|unauthorized|forbidden/i.test(
    error.message
  );
}

async function callResolvedProfile(
  profile: ExecutionProfile,
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: unknown
): Promise<unknown> {
  console.log(
    `[LLM Router] Dispatching ${profile.provider} request: ${profile.requestedModel} -> ${profile.executionModel}`
  );

  switch (profile.provider) {
    case "gemini":
      return callGeminiProvider(
        profile.executionModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        profile.apiKey!
      );
    case "openai":
      return callOpenAIProvider(
        profile.executionModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        profile.apiKey!
      );
    case "anthropic":
      return callAnthropicProvider(
        profile.executionModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        profile.apiKey!
      );
    case "sarvam":
      return callSarvamProvider(
        profile.executionModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        profile.apiKey!
      );
    case "local-llm":
      return callOpenAICompatibleProvider(
        "Local LLM",
        profile.baseUrl!,
        profile.executionModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        undefined,
        true
      );
    case "other-llm":
      return callOpenAICompatibleProvider(
        "Custom LLM",
        profile.baseUrl!,
        profile.executionModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        profile.apiKey,
        false
      );
    default:
      throw new Error("Unsupported provider configuration.");
  }
}

const tracedLLMCall = traceable(
  async (
    profile: ExecutionProfile,
    systemInstruction: string,
    userPrompt: string,
    responseSchema?: unknown
  ) => callResolvedProfile(profile, systemInstruction, userPrompt, responseSchema),
  {
    name: "Apex.LLMRouter",
    run_type: "llm",
    tags: ["apex", "llm-router"],
    getInvocationParams: (profile) => ({
      ls_provider: profile.provider,
      ls_model_name: profile.executionModel,
      ls_model_type: "chat",
    }),
    processInputs: (inputs) => {
      const args = "args" in inputs && Array.isArray(inputs.args) ? inputs.args : [];
      const profile = args[0] as ExecutionProfile | undefined;
      const systemInstruction = typeof args[1] === "string" ? args[1] : "";
      const userPrompt = typeof args[2] === "string" ? args[2] : "";
      return {
        provider: profile?.provider,
        requestedModel: profile?.requestedModel,
        executionModel: profile?.executionModel,
        baseUrl: profile?.baseUrl,
        systemChars: systemInstruction.length,
        promptChars: userPrompt.length,
      };
    },
  }
);

export async function callLLM(
  requestedModel: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: unknown,
  apiConfig?: ApiConfig
): Promise<unknown> {
  const modelName = requestedModel || "gemini-3.5-flash";
  const failoverChain = getFailoverChain(modelName);
  const configuredChain = failoverChain.filter((candidate, index) => {
    const configured = hasConfiguredProvider(candidate, apiConfig);
    if (!configured && index > 0) {
      console.warn(`[LLM Router Failover] Skipping unconfigured fallback provider: ${candidate}`);
    }
    return configured;
  });

  const candidates = configuredChain.length > 0 ? configuredChain : [modelName];
  let lastError: Error | null = null;

  for (const modelCandidate of candidates) {
    try {
      const profile = withCacheIdentity(resolveExecutionProfile(modelCandidate, apiConfig));
      const cacheKey = computeCacheKey(
        systemInstruction,
        userPrompt,
        profile.cacheIdentity,
        responseSchema
      );
      const cached = getCachedResponse(cacheKey);
      if (cached !== undefined) {
        console.log(`[LLM Cache] Cache HIT (${profile.provider}: ${profile.executionModel})`);
        return cached;
      }

      if (modelCandidate !== modelName) {
        console.warn(
          `[LLM Router Failover] Attempting configured fallback: "${modelCandidate}"`
        );
      }

      const result = await callWithRetry(() =>
        tracedLLMCall(profile, systemInstruction, userPrompt, responseSchema)
      );

      setCachedResponse(cacheKey, result);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      console.error(`[LLM Router Error] Failed for "${modelCandidate}": ${error.message}`);

      if (modelCandidate === modelName && isTerminalRoutingError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `[LLM Router Failure] All configured models in the failover chain failed. Last error: ${lastError?.message}`
  );
}
