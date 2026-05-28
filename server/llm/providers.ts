import { GoogleGenAI } from "@google/genai";
import { parseJSONCleanly } from "../utils/json.ts";

const LOCAL_SYSTEM_PROMPT =
  "You are a professional software engineering exam generator. Generate valid, clean JSON adhering strictly to the schema.";

function normalizeChatCompletionsUrl(baseUrl: string): string {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  return baseUrl.endsWith("/") ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
}

function appendSchemaToPrompt(userPrompt: string, responseSchema: unknown): string {
  return `${userPrompt}

IMPORTANT: Return ONLY a raw JSON string matching the specified JSON Schema. Do NOT include any intro, code-blocks, text or markdown formatting. Start with { and end with } - Output must be valid JSON ONLY!
JSON SCHEMA:
${JSON.stringify(responseSchema)}`;
}

async function postJson<T>(url: string, headers: Record<string, string>, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${res.status} ${res.statusText} - ${errorText}`);
  }

  return res.json() as Promise<T>;
}

export async function callGeminiProvider(
  modelName: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: unknown | undefined,
  apiKey: string
): Promise<unknown> {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
    },
  });

  const params: Record<string, unknown> = {
    model: modelName === "gemini-3.5-pro" ? "gemini-3.5-pro" : "gemini-3.5-flash",
    input: userPrompt,
    system_instruction: systemInstruction,
  };

  if (responseSchema) {
    params.response_format = {
      type: "text",
      mime_type: "application/json",
      schema: responseSchema,
    };
  }

  const interaction = (await client.interactions.create(
    params as unknown as Parameters<typeof client.interactions.create>[0]
  )) as { steps?: { type?: string; content?: { text?: string }[] }[] };
  const modelOutputStep = interaction.steps?.find((step) => step.type === "model_output");
  const text = modelOutputStep?.content?.[0]?.text;

  if (!text) {
    throw new Error("Empty response returned from Google Gemini via Interactions API.");
  }

  return parseJSONCleanly(text, modelName);
}

export async function callOpenAIProvider(
  modelName: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: unknown | undefined,
  apiKey: string
): Promise<unknown> {
  const openaiModelId = modelName === "openai-gpt-4o" ? "gpt-4o" : "gpt-4o-mini";
  let systemContent = systemInstruction;

  if (responseSchema) {
    systemContent += `\n\nReturn output strictly complying with this JSON Schema: \n${JSON.stringify(responseSchema)}`;
  }

  const payload: Record<string, unknown> = {
    model: openaiModelId,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  };

  if (responseSchema) {
    payload.response_format = { type: "json_object" };
  }

  const data = await postJson<{
    choices?: { message?: { content?: string } }[];
  }>("https://api.openai.com/v1/chat/completions", {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }, payload);

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response returned from OpenAI completions.");
  return parseJSONCleanly(text, openaiModelId);
}

export async function callAnthropicProvider(
  modelName: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: unknown | undefined,
  apiKey: string
): Promise<unknown> {
  const claudeModelId =
    modelName === "claude-3-5-sonnet" ? "claude-3-5-sonnet-20241022" : "claude-3-5-haiku-20241022";

  const fullPrompt = responseSchema ? appendSchemaToPrompt(userPrompt, responseSchema) : userPrompt;

  const data = await postJson<{ content?: { text?: string }[] }>(
    "https://api.anthropic.com/v1/messages",
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    {
      model: claudeModelId,
      system: systemInstruction,
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 4000,
      temperature: 0.2,
    }
  );

  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Empty response returned from Anthropic completions.");
  return parseJSONCleanly(text, claudeModelId);
}

export async function callSarvamProvider(
  systemInstruction: string,
  userPrompt: string,
  responseSchema: unknown | undefined,
  apiKey: string
): Promise<unknown> {
  const sarvamPrompt = responseSchema ? appendSchemaToPrompt(userPrompt, responseSchema) : userPrompt;

  const data = await postJson<{ choices?: { message?: { content?: string } }[] }>(
    "https://api.sarvam.ai/v1/chat/completions",
    {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    {
      model: "sarvam-2b-instruct",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: sarvamPrompt },
      ],
      temperature: 0.2,
    }
  );

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response returned from Sarvam AI completions.");
  return parseJSONCleanly(text, "sarvam-2b-instruct");
}

export async function callOpenAICompatibleProvider(
  label: string,
  baseUrl: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema: unknown | undefined,
  apiKey?: string,
  compressSystemForLocal = false
): Promise<unknown> {
  const targetUrl = normalizeChatCompletionsUrl(baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const prompt = responseSchema ? appendSchemaToPrompt(userPrompt, responseSchema) : userPrompt;
  let systemContent = systemInstruction;
  if (compressSystemForLocal && systemContent.length > 500) {
    systemContent = LOCAL_SYSTEM_PROMPT;
  }

  const data = await postJson<{ choices?: { message?: { content?: string } }[] }>(
    targetUrl,
    headers,
    {
      model,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }
  );

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${label} did not return a valid chat completion response.`);
  }

  return parseJSONCleanly(text, model);
}

export type ProviderKind = "gemini" | "openai" | "anthropic" | "sarvam" | "local-llm" | "other-llm";

export function resolveProvider(modelName: string): ProviderKind {
  if (modelName === "local-llm") return "local-llm";
  if (modelName === "other-llm") return "other-llm";
  if (modelName.startsWith("openai")) return "openai";
  if (modelName.startsWith("claude") || modelName.startsWith("anthropic")) return "anthropic";
  if (modelName.startsWith("sarvam")) return "sarvam";
  return "gemini";
}
