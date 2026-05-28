import type { ApiConfig } from "../../shared/apiContract.ts";

export interface GraphState {
  documentText: string;
  numPapers: number;
  numQuestions: number;
  paperDurationMins: number;
  model: string;
  apiConfig: ApiConfig;
  skills: string[];
  papers: Array<{ id: number; name: string; questions?: unknown[]; durationMins?: number }>;
  segments: string[];
  developerProfiles: Record<string, string[]>;
  questionsGenerated: Record<number, Record<string, unknown>[]>;
  errors: string[];
}

export type NodeFunction = (state: GraphState) => Promise<Partial<GraphState>>;
