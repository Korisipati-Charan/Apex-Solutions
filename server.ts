import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";


// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Helper to get GoogleGenAI client (lazy styled as per guidelines)
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the AI Studio platform. Please add it to your secrets.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function parseJSONCleanly(text: string, modelLabel: string): any {
  let cleaned = text.trim();
  // Remove markdown wrapper
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const extracted = cleaned.slice(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(extracted);
      } catch (innerErr) {
        // Fall through
      }
    }
    throw new Error(`Model "${modelLabel}" returned content that could not be parsed as valid JSON. Raw response snippet: "${cleaned.slice(0, 300)}...". Please check settings and retry.`);
  }
}

// ---------------------------------------------------------------------------
// UNIFIED MULTI-PROVIDER LLM ROUTER ENGINE
// ---------------------------------------------------------------------------
async function callLLM(
  requestedModel: string,
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: any,
  apiConfig?: any
): Promise<any> {
  const modelName = requestedModel || "gemini-3.5-flash";
  console.log(`[LLM Router] Request routed to model: ${modelName}`);

  // 1. Determine provider
  let provider = "gemini";
  if (modelName === "local-llm") {
    provider = "local-llm";
  } else if (modelName === "other-llm") {
    provider = "other-llm";
  } else if (modelName.startsWith("openai")) {
    provider = "openai";
  } else if (modelName.startsWith("claude") || modelName.startsWith("anthropic")) {
    provider = "anthropic";
  } else if (modelName.startsWith("sarvam")) {
    provider = "sarvam";
  }

  // 2. Retrieve corresponding config, prioritizing client inputs, then server config
  const activeGeminiKey = apiConfig?.geminiApiKey || process.env.GEMINI_API_KEY;
  const activeOpenaiKey = apiConfig?.openaiApiKey || process.env.OPENAI_API_KEY;
  const activeAnthropicKey = apiConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const activeSarvamKey = apiConfig?.sarvamApiKey || process.env.SARVAM_API_KEY;
  const activeLocalUrl = apiConfig?.localLlmUrl || "http://localhost:11434/v1";
  const activeLocalModel = apiConfig?.localLlmModel || "llama3";
  const activeOtherUrl = apiConfig?.otherLlmUrl || "https://api.openai.com/v1";
  const activeOtherModel = apiConfig?.otherLlmModel || "gpt-4o";
  const activeOtherApiKey = apiConfig?.otherLlmApiKey || "";

  // NO SILENT FALLBACK AI. Throw a descriptive configuration error if the key is missing.
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

  // 3. Dispatch to proper API
  if (provider === "gemini") {
    const client = new GoogleGenAI({
      apiKey: activeGeminiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const params: any = {
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

    const interaction = await client.interactions.create(params);
    const modelOutputStep = interaction.steps?.find((step: any) => step.type === "model_output") as any;
    const text = modelOutputStep?.content?.[0]?.text;

    if (!text) {
      throw new Error(`Empty response returned from Google Gemini core via Interactions API.`);
    }
    return JSON.parse(text);
  }

  if (provider === "openai") {
    let openaiModelId = "gpt-4o-mini";
    if (modelName === "openai-gpt-4o") {
      openaiModelId = "gpt-4o";
    }

    const headers: any = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${activeOpenaiKey}`,
    };

    const payload: any = {
      model: openaiModelId,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
    };

    if (responseSchema) {
      payload.response_format = { type: "json_object" };
      payload.messages[0].content += `\n\nReturn output strictly complying with this JSON Schema: \n${JSON.stringify(responseSchema)}`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API failed: ${res.statusText} - ${errorText}`);
    }

    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Empty response returned from OpenAI completions.`);
    }

    return parseJSONCleanly(text, openaiModelId);
  }

  if (provider === "anthropic") {
    let claudeModelId = "claude-3-5-haiku-20241022";
    if (modelName === "claude-3-5-sonnet") {
      claudeModelId = "claude-3-5-sonnet-20241022";
    }

    const headers: any = {
      "Content-Type": "application/json",
      "x-api-key": activeAnthropicKey,
      "anthropic-version": "2023-06-01"
    };

    let fullPrompt = userPrompt;
    if (responseSchema) {
      fullPrompt += `\n\nIMPORTANT: Return ONLY a raw JSON string matching the specified JSON Schema. Do NOT include any intro, code blocks, explanation or markdown formatting like \`\`\`json. Valid JSON ONLY!
JSON SCHEMA:
${JSON.stringify(responseSchema)}`;
    }

    const payload = {
      model: claudeModelId,
      system: systemInstruction,
      messages: [{ role: "user", content: fullPrompt }],
      max_tokens: 4000,
      temperature: 0.2,
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic API failed: ${res.statusText} - ${errorText}`);
    }

    const data: any = await res.json();
    let text = data.content?.[0]?.text;
    if (!text) {
      throw new Error(`Empty response returned from Anthropic completions.`);
    }

    return parseJSONCleanly(text, claudeModelId);
  }

  if (provider === "sarvam") {
    const headers: any = {
      "Content-Type": "application/json",
      "api-subscription-key": activeSarvamKey,
    };

    let sarvamPrompt = userPrompt;
    if (responseSchema) {
      sarvamPrompt += `\n\nIMPORTANT: Return ONLY a raw JSON string matching the specified JSON Schema. Do NOT include any intro, explanation or markdown formatting like \`\`\`json. Valid JSON ONLY!
JSON SCHEMA:
${JSON.stringify(responseSchema)}`;
    }

    const payload = {
      model: "sarvam-2b-instruct",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: sarvamPrompt }
      ],
      temperature: 0.2,
    };

    const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sarvam AI API failed: ${res.statusText} - ${errorText}`);
    }

    const data: any = await res.json();
    let text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Empty response returned from Sarvam AI completions.`);
    }

    return parseJSONCleanly(text, "sarvam-2b-instruct");
  }

  if (provider === "local-llm") {
    console.log(`[LLM Router] Calling Local LLM at ${activeLocalUrl} with model ${activeLocalModel}`);
    
    // Auto normalize local URL
    let targetUrl = activeLocalUrl;
    if (!targetUrl.endsWith("/chat/completions")) {
      targetUrl = targetUrl.endsWith("/") ? `${targetUrl}chat/completions` : `${targetUrl}/chat/completions`;
    }
    
    const headers: any = {
      "Content-Type": "application/json"
    };

    let localPrompt = userPrompt;
    if (responseSchema) {
      localPrompt += `\n\nIMPORTANT: Return ONLY a raw JSON string matching the specified JSON Schema. Do NOT include any intro, code-blocks, text or markdown formatting. Start with { and end with } - Output must be valid JSON ONLY!
JSON SCHEMA:
${JSON.stringify(responseSchema)}`;
    }

    const payload = {
      model: activeLocalModel,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: localPrompt }
      ],
      temperature: 0.2
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Local LLM server failed: ${res.statusText} - ${errorText}. Please verify that your local service (Ollama, LM Studio, or vLLM) is running and accessible at "${activeLocalUrl}".`);
    }

    const data: any = await res.json();
    let text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Local LLM did not return a valid chat completion response.`);
    }

    return parseJSONCleanly(text, activeLocalModel);
  }

  if (provider === "other-llm") {
    console.log(`[LLM Router] Calling Custom LLM at ${activeOtherUrl} with model ${activeOtherModel}`);
    
    let targetUrl = activeOtherUrl;
    if (!targetUrl.endsWith("/chat/completions")) {
      targetUrl = targetUrl.endsWith("/") ? `${targetUrl}chat/completions` : `${targetUrl}/chat/completions`;
    }
    
    const headers: any = {
      "Content-Type": "application/json"
    };

    if (activeOtherApiKey) {
      headers["Authorization"] = `Bearer ${activeOtherApiKey}`;
    }

    let otherPrompt = userPrompt;
    if (responseSchema) {
      otherPrompt += `\n\nIMPORTANT: Return ONLY a raw JSON string matching the specified JSON Schema. Do NOT include any intro, code-blocks, text or markdown formatting. Start with { and end with } - Output must be valid JSON ONLY!
JSON SCHEMA:
${JSON.stringify(responseSchema)}`;
    }

    const payload = {
      model: activeOtherModel,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: otherPrompt }
      ],
      temperature: 0.2
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Custom LLM server failed: ${res.statusText} - ${errorText}. Please verify your custom endpoint URL and api key params.`);
    }

    const data: any = await res.json();
    let text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`Custom LLM did not return a valid chat completion response.`);
    }

    return parseJSONCleanly(text, activeOtherModel);
  }

  throw new Error(`Unsupported provider configuration.`);
}

// ---------------------------------------------------------------------------
// API ENDPOINTS
// ---------------------------------------------------------------------------

// Connection Verification
app.post("/api/test-connection", async (req, res) => {
  try {
    const { model, apiConfig } = req.body;
    const info = await callLLM(
      model,
      "You are a quick API validation assistant. Confirm receipt of this message in raw JSON format.",
      "Reply with exactly dynamic JSON having: {\"status\": \"success\", \"message\": \"API Verified! API connection operates perfectly.\"}",
      undefined,
      apiConfig
    );
    res.json({ ok: true, info });
  } catch (error: any) {
    console.error("[Test Connection Error]:", error);
    res.status(500).json({ ok: false, error: error.message || "Failed to establish AI core connection." });
  }
});

// Helper to extract readable printable characters from any binary buffer as a fail-safe fallback
function extractPrintableText(buffer: Buffer): string {
  try {
    const rawString = buffer.toString("binary");
    // Matches sequences of 4 or more printable ASCII characters (between decimal 32 and 126, plus tabs and newlines)
    const matches = rawString.match(/[\x20-\x7E\t\r\n]{4,}/g);
    if (matches && matches.length > 0) {
      const cleanMatches = [];
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i].trim();
        if (m) cleanMatches.push(m);
      }
      return cleanMatches.join("\n");
    }
  } catch (e) {
    // Ignore and proceed
  }
  return "[No printable text characters discovered in the file binary data]";
}

// File Parser Endpoint (PDF/Word/Prompts extraction)
app.post("/api/parse-file", async (req, res) => {
  const { base64Data, fileName } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: "File data is required." });
  }

  const buffer = Buffer.from(base64Data, "base64");
  const ext = path.extname(fileName).toLowerCase();
  let extractedText = "";

  try {
    if (ext === ".pdf") {
      try {
        const pdfParseModule = require("pdf-parse");
        if (typeof pdfParseModule === "function") {
          const data = await pdfParseModule(buffer);
          extractedText = data.text;
        } else if (pdfParseModule && typeof pdfParseModule.PDFParse === "function") {
          const instance = new pdfParseModule.PDFParse({ data: buffer });
          const data = await instance.getText();
          extractedText = data.text;
        } else {
          throw new Error("Invalid PDF parser module structure.");
        }
      } catch (pdfErr: any) {
        console.warn(`[Resilient PDF Parser Fallback] Native PDF parsing failed for ${fileName}:`, pdfErr.message);
        extractedText = `[PDF Parsing Fallback Content due to complex layout/visual data]\n\n` + extractPrintableText(buffer);
      }
    } else if (ext === ".docx") {
      try {
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } catch (docxErr: any) {
        console.warn(`[Resilient DOCX Parser Fallback] Native DOCX parsing failed for ${fileName}:`, docxErr.message);
        extractedText = `[Word Parsing Fallback Content due to complex layout/visual data]\n\n` + extractPrintableText(buffer);
      }
    } else if (ext === ".doc") {
      // Legacy .doc does not have an offline-first library installed; extract printables directly
      extractedText = `[Legacy Word (.doc) Extracted Content]\n\n` + extractPrintableText(buffer);
    } else {
      // For any other file formats (images, CSVs, binaries, custom types, executables, charts, etc.)
      // For any other file formats (images, CSVs, binaries, custom types, executables, charts, etc.)
      // First try standard UTF-8 text decode
      try {
        const rawUtf8 = buffer.toString("utf-8");
        // Verify if it contains a high density of control/binary characters
        const binaryChars = rawUtf8.split("").filter(c => {
          const code = c.charCodeAt(0);
          return (code < 32 && c !== "\n" && c !== "\r" && c !== "\t");
        }).length;
        
        if (binaryChars / rawUtf8.length < 0.05) {
          extractedText = rawUtf8;
        } else {
          // If the file is binary (e.g. PNG, JPG, ZIP, XLSX), run our custom string extractor
          extractedText = `[Binary/Visual Content Extracted Strings from: ${fileName}]\n\n` + extractPrintableText(buffer);
        }
      } catch (utf8Err) {
        extractedText = `[Binary/Visual Content Extracted Strings from: ${fileName}]\n\n` + extractPrintableText(buffer);
      }
    }

    res.json({ ok: true, text: extractedText });
  } catch (error: any) {
    console.error("[Resilient Parse File Error]:", error);
    // Even in case of global failure, fall back to printable strings so that we never return 500 error!
    res.json({ ok: true, text: `[Fatal parsing error on ${fileName}. Recovered raw data strings:]\n\n` + extractPrintableText(buffer) });
  }
});

// 1. Generate Assessment
app.post("/api/generate-exam", async (req, res) => {
  try {
    const { documentText, numPapers = 2, numQuestions = 90, paperDurationMins = 180, model, apiConfig } = req.body;

    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({ error: "Syllabus details or skill documents are required to generate the examination." });
    }

    const systemPrompt = `You are a Top Industry Assessment Compiler and you are given a task to analyse the given documents clearly and Extract the skills mentioned in the docs. You have Create 1 or 2 paper Assessment with 90 questions or different as specified by the user. Default is 2 paper and 90 questions each paper. The scope of the syllabus is skills mentioned in the docs provided.`;

    const instructions = `
Analyzing the input documents, please:
1. Extract the key technical skills, concepts, and framework topics mentioned.
2. Structure a robust technical assessment matching the skills.
3. You should generate exactly ${numPapers} papers with exactly ${numQuestions} multiple-choice questions per paper.
4. Each question should have exactly 4 logical options (A, B, C, D) tailored for technical developers, a clear correct answer, an explanation, and should specify which extracted skill they test. Include markdown formatting inside the questions or custom code snippets where relevant.

INPUT DOCUMENTS CONTENT:
${documentText.slice(0, 50000)} // Safety limit
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        skills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Brief list of primary skills extracted from the documents"
        },
        papers: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER, description: "Paper number, starting from 1" },
              name: { type: Type.STRING, description: "Paper title" },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "Question ID like q_1" },
                    text: { type: Type.STRING, description: "Highly technical multi-choice question evaluating developer skills" },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Exactly 4 options, labeled as 'A. ...', 'B. ...', 'C. ...', 'D. ...' or plain text options"
                    },
                    correctAnswer: { type: Type.STRING, description: "One letter choice among A, B, C, D" },
                    explanation: { type: Type.STRING, description: "Logical educational explanation explaining why this answer is correct" },
                    skill: { type: Type.STRING, description: "Specific extracted skill tested" },
                    codeSnippet: { type: Type.STRING, description: "Optional code snippet using markdown tags, or keep empty if unnecessary" }
                  },
                  required: ["id", "text", "options", "correctAnswer", "explanation", "skill"]
                }
              }
            },
            required: ["id", "name", "questions"]
          }
        }
      },
      required: ["skills", "papers"]
    };

    const data = await callLLM(model, systemPrompt, instructions, responseSchema, apiConfig);
    return res.json(data);
  } catch (error: any) {
    console.error("Generate Exam Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred with assessment planning." });
  }
});

// 2. Performance Evaluation via Educator AI
app.post("/api/analyze-performance", async (req, res) => {
  try {
    const { examSetup, paperResponses, model, apiConfig } = req.body;

    if (!examSetup || !paperResponses) {
      return res.status(400).json({ error: "Exam details and candidate responses are required." });
    }

    // Compile simplified candidate details
    const candidateData = {
      title: examSetup.title,
      skillsTargeted: examSetup.skills,
      papersSubmitted: Object.entries(paperResponses).map(([paperIdStr, paperRespState]: [string, any]) => {
        const paperId = parseInt(paperIdStr, 10);
        const refPaper = examSetup.papers.find((p: any) => p.id === paperId);
        
        let correctCount = 0;
        let totalCount = 0;
        const details = [];

        if (refPaper) {
          totalCount = refPaper.questions.length;
          for (const q of refPaper.questions) {
            const resp = paperRespState.answers[q.id];
            const candidateAnswer = resp ? resp.selectedOption : "No Answer";
            const isCorrect = resp && resp.selectedOption === q.correctAnswer;
            if (isCorrect) correctCount++;

            details.push({
              skill: q.skill,
              question: q.text,
              candidateAnswer,
              correctAnswer: q.correctAnswer,
              isCorrect,
              codeSnippet: q.codeSnippet || ""
            });
          }
        }

        return {
          paperId,
          paperName: refPaper ? refPaper.name : `Paper ${paperId}`,
          totalQuestions: totalCount,
          correctAnswers: correctCount,
          scorePercentage: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
          timeSpentMins: Math.ceil(paperRespState.timeSpentSecs / 60),
          details
        };
      })
    };

    const educatorSystemPrompt = `You are a Top Industry Educator. Your task is to analyze candidate's exam performance and weak areas based solely on the provided correct/incorrect answers. Create a highly visually appealing, structured analysis of the candidate's performance, strengths, and gaps. Speak directly to the developer in a warm, motivating, highly smart technical tone. Do NOT include any recommendation roadmap or study timeline.`;

    const instructions = `
Please analyze the candidate's performance across the compiled multiple-choice assessments below.
For weak areas, specify standard diagnostic descriptions and clear takeaways.

CANDIDATE EXAM RESULTS PACK:
${JSON.stringify(candidateData, null, 2)}
`;

    const educatorSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "Motivating, structured educational feedback summarizing their overarching baseline skills." },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Core strengths noticed based on high scoring modules." },
        weakAreas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skillName: { type: Type.STRING, description: "Name of the study field or topic" },
              gapDescription: { type: Type.STRING, description: "Technical diagnosis of what candidate lacks or where they miscalculated" },
              keyConceptToMaster: { type: Type.STRING, description: "Underlying Computer Science concept or methodology they should read up." }
            },
            required: ["skillName", "gapDescription", "keyConceptToMaster"]
          }
        },
        skillScores: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill: { type: Type.STRING },
              correct: { type: Type.INTEGER },
              total: { type: Type.INTEGER },
              percentage: { type: Type.NUMBER }
            },
            required: ["skill", "correct", "total", "percentage"]
          }
        }
      },
      required: ["summary", "strengths", "weakAreas", "skillScores"]
    };

    const data = await callLLM(model, educatorSystemPrompt, instructions, educatorSchema, apiConfig);
    return res.json(data);
  } catch (error: any) {
    console.error("Educator AI Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred during Educator pedagogic planning." });
  }
});

// ---------------------------------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// ---------------------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = __dirname;
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Binary Core] Standalone Environment booting on port ${PORT}`);
  });
}

start();
