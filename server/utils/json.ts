export function parseJSONCleanly(text: string, modelLabel: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const extracted = cleaned.slice(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(extracted);
      } catch {
        // Fall through
      }
    }
    throw new Error(
      `Model "${modelLabel}" returned content that could not be parsed as valid JSON. Raw response snippet: "${cleaned.slice(0, 300)}...". Please check settings and retry.`
    );
  }
}
