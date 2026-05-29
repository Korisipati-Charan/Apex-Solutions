export interface Question {
  id: string;
  text: string;
  options: string[]; // Options array, e.g., [Option A, Option B, Option C, Option D]
  correctAnswer: string; // A, B, C, or D
  explanation: string;
  skill: string; // The extracted skill this question maps to
  codeSnippet?: string; // Optional code snippet to display in mono font
}

export interface Paper {
  id: number; // 1 or 2
  name: string;
  questions: Question[];
  durationMins: number;
}

export interface ExamSetup {
  id: string;
  title: string;
  skills: string[];
  papers: Paper[];
  paperDurationMins: number;
  breakDurationMins: number; // default sixty minutes (3600 seconds)
  createdAt: string;
  generationWarnings?: string[];
}

export interface CandidateResponse {
  questionId: string;
  selectedOption: string | null; // A, B, C, D
  flagged: boolean;
  scratchpad: string; // Scratchpad content specific to this question
}

export interface PaperResponseState {
  paperId: number;
  answers: Record<string, CandidateResponse>;
  timeRemainingSecs: number;
  status: "not_started" | "ongoing" | "submitted" | "timed_out";
  startedAt?: string;
  submittedAt?: string;
  timeSpentSecs: number;
}

export interface ExamState {
  examSetup: ExamSetup | null;
  paperResponses: Record<number, PaperResponseState>; // Keyed by paperId (1, 2)
  currentPaperId: number; // 1 or 2
  breakState: {
    status: "inactive" | "ongoing" | "completed" | "skipped";
    timeRemainingSecs: number;
  };
  overallStatus: "setup" | "paper_1" | "break" | "paper_2" | "completed";
  educatorAnalysis: EducatorAnalysis | null;
  educatorLoading: boolean;
  educatorError: string | null;
}

export interface SkillScore {
  skill: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface EducatorAnalysis {
  summary: string;
  strengths: string[];
  weakAreas: {
    skillName: string;
    gapDescription: string;
    keyConceptToMaster: string;
  }[];
  skillScores: SkillScore[];
  recommendationRoadmap?: {
    title: string;
    description: string;
    weeks: { week: string; topic: string; actions: string[] }[];
  };
}

export interface HistoricalReport {
  id: string;
  title: string;
  createdAt: string;
  examSetup: ExamSetup;
  paperResponses: Record<number, PaperResponseState>;
  educatorAnalysis: EducatorAnalysis;
}
