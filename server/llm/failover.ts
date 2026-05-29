export function getFailoverChain(requestedModel: string): string[] {
  const chain = [requestedModel];
  const crossProviderFailoverEnabled = process.env.APEX_ENABLE_CROSS_PROVIDER_FAILOVER === "true";
  const localFallbackEnabled = process.env.APEX_ENABLE_LOCAL_LLM_FALLBACK === "true";

  if (!crossProviderFailoverEnabled) {
    return chain;
  }

  if (requestedModel === "gemini-3.5-pro") {
    chain.push("gemini-3.5-flash");
  } else if (requestedModel === "gemini-3.5-flash") {
    // No same-provider fallback below flash.
  } else if (requestedModel === "openai-gpt-4o") {
    chain.push("gemini-3.5-flash");
  } else if (requestedModel === "claude-3-5-sonnet") {
    chain.push("gemini-3.5-flash");
  } else if (requestedModel !== "local-llm") {
    chain.push("gemini-3.5-flash");
  }

  if (localFallbackEnabled && requestedModel !== "local-llm") {
    chain.push("local-llm");
  }

  return [...new Set(chain)];
}
