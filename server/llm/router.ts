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
} from "./providers.ts";

import type { ApiConfig } from "../../shared/apiContract.ts";

export type { ApiConfig };

async function callLLMSingle(
  requestedModel: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: unknown,
  apiConfig?: ApiConfig
): Promise<unknown> {
  const modelName = requestedModel || "gemini-3.5-flash";
  const provider = resolveProvider(modelName);

  const activeGeminiKey = apiConfig?.geminiApiKey || process.env.GEMINI_API_KEY;
  const activeOpenaiKey = apiConfig?.openaiApiKey || process.env.OPENAI_API_KEY;
  const activeAnthropicKey = apiConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const activeSarvamKey = apiConfig?.sarvamApiKey || process.env.SARVAM_API_KEY;
  const activeLocalUrl = apiConfig?.localLlmUrl || "http://localhost:11434/v1";
  const activeLocalModel = apiConfig?.localLlmModel || "llama3";
  const activeOtherUrl = apiConfig?.otherLlmUrl || "https://api.openai.com/v1";
  const activeOtherModel = apiConfig?.otherLlmModel || "gpt-4o";
  const activeOtherApiKey = apiConfig?.otherLlmApiKey || "";

  if (provider === "gemini" && !activeGeminiKey) {
    throw new Error("Configuration Error: Gemini API Key is not configured. Please add it to your Workspace Preferences.");
  }
  if (provider === "openai" && !activeOpenaiKey) {
    throw new Error("Configuration Error: OpenAI API Key is not configured. Please enter your OpenAI API key in your Workspace Preferences.");
  }
  if (provider === "anthropic" && !activeAnthropicKey) {
    throw new Error("Configuration Error: Anthropic API Key is not configured. Please enter your Anthropic API key in your Workspace Preferences.");
  }
  if (provider === "sarvam" && !activeSarvamKey) {
    throw new Error("Configuration Error: Sarvam AI API Key is not configured. Please enter your Sarvam AI subscription key in your Workspace Preferences.");
  }
  if (provider === "other-llm" && !activeOtherUrl) {
    throw new Error("Configuration Error: Custom LLM Endpoint URL is not configured. Please enter your Custom Endpoint URL in your Workspace Preferences.");
  }

  console.log(`[LLM Router] Dispatching request to model: ${modelName}`);

  switch (provider) {
    case "gemini":
      return callGeminiProvider(modelName, systemInstruction, userPrompt, responseSchema, activeGeminiKey!);
    case "openai":
      return callOpenAIProvider(modelName, systemInstruction, userPrompt, responseSchema, activeOpenaiKey!);
    case "anthropic":
      return callAnthropicProvider(modelName, systemInstruction, userPrompt, responseSchema, activeAnthropicKey!);
    case "sarvam":
      return callSarvamProvider(systemInstruction, userPrompt, responseSchema, activeSarvamKey!);
    case "local-llm":
      console.log(`[LLM Router] Calling Local LLM at ${activeLocalUrl} with model ${activeLocalModel}`);
      return callOpenAICompatibleProvider(
        "Local LLM",
        activeLocalUrl,
        activeLocalModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        undefined,
        true
      );
    case "other-llm":
      console.log(`[LLM Router] Calling Custom LLM at ${activeOtherUrl} with model ${activeOtherModel}`);
      return callOpenAICompatibleProvider(
        "Custom LLM",
        activeOtherUrl,
        activeOtherModel,
        systemInstruction,
        userPrompt,
        responseSchema,
        activeOtherApiKey || undefined,
        false
      );
    default:
      throw new Error("Unsupported provider configuration.");
  }
}

export async function callLLM(
  requestedModel: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: unknown,
  apiConfig?: ApiConfig
): Promise<unknown> {
  const modelName = requestedModel || "gemini-3.5-flash";
  const cacheKey = computeCacheKey(systemInstruction, userPrompt, modelName, responseSchema);
  const cached = getCachedResponse(cacheKey);
  if (cached !== undefined) {
    console.log(`[LLM Cache] Cache HIT (Model: ${modelName})`);
    return cached;
  }

  const failoverChain = getFailoverChain(modelName);
  let lastError: Error | null = null;

  for (const modelCandidate of failoverChain) {
    try {
      if (modelCandidate !== modelName) {
        console.warn(
          `[LLM Router Failover] Primary model failed/unconfigured. Attempting failover to: "${modelCandidate}"`
        );
      }

      const result = await callWithRetry(() =>
        callLLMSingle(modelCandidate, systemInstruction, userPrompt, responseSchema, apiConfig)
      );

      setCachedResponse(cacheKey, result);
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      console.error(`[LLM Router Error] Failed for "${modelCandidate}": ${error.message}`);
    }
  }

  throw new Error(
    `[LLM Router Catastrophic Failure] All models in the failover chain failed. Last error: ${lastError?.message}`
  );
}
