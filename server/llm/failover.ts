export function getFailoverChain(requestedModel: string): string[] {
  const chain = [requestedModel];

  if (requestedModel === "gemini-3.5-pro") {
    chain.push("gemini-3.5-flash", "local-llm");
  } else if (requestedModel === "gemini-3.5-flash") {
    chain.push("local-llm");
  } else if (requestedModel === "openai-gpt-4o") {
    chain.push("gemini-3.5-flash", "local-llm");
  } else if (requestedModel === "claude-3-5-sonnet") {
    chain.push("gemini-3.5-flash", "local-llm");
  } else if (requestedModel !== "local-llm") {
    chain.push("gemini-3.5-flash", "local-llm");
  }

  return chain;
}
