import {
  clampUiPaperCount,
  clampUiQuestionCount,
  type GenerateExamRequest,
} from "../../shared/apiContract.ts";

export interface ValidatedGenerateExamInput {
  documentText: string;
  numPapers: 1 | 2;
  numQuestions: 10 | 30 | 45 | 90;
  paperDurationMins: number;
  model: string;
  apiConfig: GenerateExamRequest["apiConfig"];
}

export function validateGenerateExamBody(body: unknown):
  | { ok: true; value: ValidatedGenerateExamInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const payload = body as Record<string, unknown>;
  const documentText = typeof payload.documentText === "string" ? payload.documentText.trim() : "";

  if (!documentText) {
    return {
      ok: false,
      error: "Syllabus details or skill documents are required to generate the examination.",
    };
  }

  const numPapers = clampUiPaperCount(Number(payload.numPapers) || 2);
  const numQuestions = clampUiQuestionCount(Number(payload.numQuestions) || 90);
  const paperDurationMins = Math.min(
    360,
    Math.max(15, Number(payload.paperDurationMins) || 180)
  );
  const model = typeof payload.model === "string" && payload.model.trim()
    ? payload.model.trim()
    : "gemini-3.5-flash";

  return {
    ok: true,
    value: {
      documentText,
      numPapers,
      numQuestions,
      paperDurationMins,
      model,
      apiConfig: (payload.apiConfig as GenerateExamRequest["apiConfig"]) ?? null,
    },
  };
}
