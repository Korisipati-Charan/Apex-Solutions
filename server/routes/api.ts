import type { Express } from "express";
import { Type } from "@google/genai";
import type { ApiConfig, EducatorAnalysisResponse } from "../../shared/apiContract.ts";
import { runExamGenerationGraph } from "../graph/examGraph.ts";
import type { GraphState } from "../graph/types.ts";
import { callLLM } from "../llm/router.ts";
import { normalizeCandidateAnswer, normalizeLetterAnswer } from "../normalize/examPayload.ts";
import { validateGenerateExamBody } from "../validate/request.ts";
import { handleParseFile } from "./parseFile.ts";

export function registerApiRoutes(app: Express): void {
  app.post("/api/test-connection", async (req, res) => {
    try {
      const { model, apiConfig } = req.body as { model: string; apiConfig?: ApiConfig };
      if (!model) {
        res.status(400).json({ ok: false, error: "Model selection is required." });
        return;
      }

      const info = await callLLM(
        model,
        "You are a quick API validation assistant. Confirm receipt of this message in raw JSON format.",
        'Reply with exactly dynamic JSON having: {"status": "success", "message": "API Verified! API connection operates perfectly."}',
        undefined,
        apiConfig
      );
      res.json({ ok: true, info });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to establish AI core connection.";
      console.error("[Test Connection Error]:", message);
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.post("/api/parse-file", (req, res) => {
    void handleParseFile(req, res);
  });

  app.post("/api/generate-exam", async (req, res) => {
    try {
      const validated = validateGenerateExamBody(req.body);
      if (validated.ok === false) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const { documentText, numPapers, numQuestions, paperDurationMins, model, apiConfig } =
        validated.value;

      const initialState: GraphState = {
        documentText,
        numPapers,
        numQuestions,
        paperDurationMins,
        model,
        apiConfig: apiConfig || {},
        skills: [],
        papers: [],
        segments: [],
        developerProfiles: {},
        questionsGenerated: {},
        errors: [],
      };

      const finalState = await runExamGenerationGraph(initialState);

      if (finalState.papers.length === 0) {
        throw new Error(
          `[LangGraph Engine Fail] Failed to compile papers. Logs: ${finalState.errors.join("; ")}`
        );
      }

      console.log(
        `[LangGraph Engine] Completed. Papers: ${finalState.papers.length}. Skills: [${finalState.skills.join(", ")}]`
      );

      res.json({
        skills: finalState.skills,
        papers: finalState.papers,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred during assessment generation.";
      console.error("[LangGraph Engine Fatal Error]:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/analyze-performance", async (req, res) => {
    try {
      const { examSetup, paperResponses, model, apiConfig } = req.body as {
        examSetup: {
          title: string;
          skills: string[];
          papers: {
            id: number;
            name: string;
            questions: {
              id: string;
              skill: string;
              text: string;
              correctAnswer: string;
              codeSnippet?: string;
            }[];
          }[];
        };
        paperResponses: Record<
          string,
          { answers: Record<string, { selectedOption?: string | null }>; timeSpentSecs: number }
        >;
        model: string;
        apiConfig?: ApiConfig;
      };

      if (!examSetup || !paperResponses) {
        res.status(400).json({ error: "Exam details and candidate responses are required." });
        return;
      }

      const candidateData = {
        title: examSetup.title,
        skillsTargeted: examSetup.skills,
        papersSubmitted: Object.entries(paperResponses).map(([paperIdStr, paperRespState]) => {
          const paperId = parseInt(paperIdStr, 10);
          const refPaper = examSetup.papers.find((p) => p.id === paperId);

          let correctCount = 0;
          let totalCount = 0;
          const details: Record<string, unknown>[] = [];

          if (refPaper) {
            totalCount = refPaper.questions.length;
            for (const q of refPaper.questions) {
              const resp = paperRespState.answers[q.id];
              const candidateLetter = normalizeCandidateAnswer(resp?.selectedOption);
              const correctLetter = normalizeLetterAnswer(q.correctAnswer);
              const candidateAnswer = candidateLetter ?? "No Answer";
              const isCorrect = candidateLetter !== null && candidateLetter === correctLetter;
              if (isCorrect) correctCount++;

              details.push({
                skill: q.skill,
                question: q.text,
                candidateAnswer,
                correctAnswer: correctLetter,
                isCorrect,
                codeSnippet: q.codeSnippet || "",
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
            details,
          };
        }),
      };

      const educatorSystemPrompt = `You are a Top Industry Educator. Analyze the candidate's exam performance and weak areas based solely on correct/incorrect answers. Create a structured analysis of strengths and gaps. Speak directly to the developer in a warm, motivating technical tone. Do NOT include any recommendation roadmap or study timeline.`;

      const instructions = `
Analyze the candidate's performance across the compiled multiple-choice assessments below.

CANDIDATE EXAM RESULTS PACK:
${JSON.stringify(candidateData, null, 2)}
`;

      const educatorSchema = {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weakAreas: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                skillName: { type: Type.STRING },
                gapDescription: { type: Type.STRING },
                keyConceptToMaster: { type: Type.STRING },
              },
              required: ["skillName", "gapDescription", "keyConceptToMaster"],
            },
          },
          skillScores: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                skill: { type: Type.STRING },
                correct: { type: Type.INTEGER },
                total: { type: Type.INTEGER },
                percentage: { type: Type.NUMBER },
              },
              required: ["skill", "correct", "total", "percentage"],
            },
          },
        },
        required: ["summary", "strengths", "weakAreas", "skillScores"],
      };

      const data = (await callLLM(
        model,
        educatorSystemPrompt,
        instructions,
        educatorSchema,
        apiConfig
      )) as EducatorAnalysisResponse;

      res.json(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "An error occurred during Educator pedagogic planning.";
      console.error("Educator AI Error:", message);
      res.status(500).json({ error: message });
    }
  });
}
