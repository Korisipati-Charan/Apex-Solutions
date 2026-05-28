import type { ApiConfig } from "../llm/router.ts";

export interface GraphState {
  documentText: string;
  numPapers: number;
  numQuestions: number;
  paperDurationMins: number;
  model: string;
  apiConfig: ApiConfig;
  skills: string[];
  papers: Record<string, unknown>[];
  segments: string[];
  developerProfiles: Record<string, string[]>;
  questionsGenerated: Record<number, Record<string, unknown>[]>;
  errors: string[];
}

export type NodeFunction = (state: GraphState) => Promise<Partial<GraphState>>;
