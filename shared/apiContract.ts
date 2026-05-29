/** Shared request/response contracts between React UI and Express backend. */

export const UI_PAPER_COUNTS = [1, 2] as const;
export const UI_QUESTION_COUNTS = [10, 30, 45, 90] as const;

export type UiPaperCount = (typeof UI_PAPER_COUNTS)[number];
export type UiQuestionCount = (typeof UI_QUESTION_COUNTS)[number];

/** Mirrors `SystemSettingsModal` ApiConfig and `localStorage` key `apex_api_config`. */
export interface ApiConfig {
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  sarvamApiKey?: string;
  sarvamModel?: string;
  localLlmUrl?: string;
  localLlmModel?: string;
  otherLlmUrl?: string;
  otherLlmModel?: string;
  otherLlmApiKey?: string;
}

/** Mirrors `src/types.ts` Question — terminal expects A–D letter answers. */
export interface UiQuestion {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
  skill: string;
  codeSnippet?: string;
}

export interface UiPaper {
  id: number;
  name: string;
  questions: UiQuestion[];
  durationMins: number;
}

export interface GenerateExamRequest {
  documentText: string;
  numPapers: number;
  numQuestions: number;
  paperDurationMins: number;
  model: string;
  apiConfig?: ApiConfig | null;
}

export interface GenerateExamResponse {
  skills: string[];
  papers: UiPaper[];
  generationWarnings?: string[];
}

export interface ParseFileRequest {
  base64Data: string;
  fileName: string;
}

export interface ParseFileResponse {
  ok: boolean;
  text?: string;
  warnings?: string[];
  error?: string;
}

export interface TestConnectionRequest {
  model: string;
  apiConfig?: ApiConfig;
}

export interface EducatorAnalysisResponse {
  summary: string;
  strengths: string[];
  weakAreas: {
    skillName: string;
    gapDescription: string;
    keyConceptToMaster: string;
  }[];
  skillScores: {
    skill: string;
    correct: number;
    total: number;
    percentage: number;
  }[];
}

export function clampUiPaperCount(value: number): UiPaperCount {
  return value <= 1 ? 1 : 2;
}

export function clampUiQuestionCount(value: number): UiQuestionCount {
  const allowed = UI_QUESTION_COUNTS as readonly number[];
  if (allowed.includes(value)) return value as UiQuestionCount;
  return allowed.reduce((prev, cur) =>
    Math.abs(cur - value) < Math.abs(prev - value) ? cur : prev
  ) as UiQuestionCount;
}
