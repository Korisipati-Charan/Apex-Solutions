import { Type } from "@google/genai";
import { callLLM } from "../llm/router.ts";
import { runWithConcurrencyLimit } from "../llm/concurrency.ts";
import { segmentSyllabusText, retrieveRAGContext } from "./rag.ts";
import { normalizePaper } from "../normalize/examPayload.ts";
import type { GraphState } from "./types.ts";

const QUESTION_CHUNK_SIZE = 10;
const MAX_PARALLEL_LLM = 3;

export async function segmentSyllabusNode(state: GraphState) {
  const segments = segmentSyllabusText(state.documentText);
  console.log(`[LangGraph] SegmentSyllabus: ${segments.length} chunks`);
  return { segments };
}

export async function isolateSkillsNode(state: GraphState) {
  const generationWarnings = [...state.generationWarnings];
  const setupSystemPrompt =
    "You are a professional assessment syllabus extractor. Identify the key technical skills mentioned in the syllabus and assign a professional name to each paper.";
  const setupUserPrompt = `
Analyze the following syllabus document:
---
${state.documentText.slice(0, 25000)}
---

Extract:
1. A list of 4 to 8 primary technical skills.
2. Exactly ${state.numPapers} paper titles corresponding to these skills.
`;

  const setupSchema = {
    type: Type.OBJECT,
    properties: {
      skills: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "4 to 8 primary technical skills mentioned in the document",
      },
      papers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER, description: "Paper number, starting from 1" },
            name: { type: Type.STRING, description: "Professional title for this exam paper" },
          },
          required: ["id", "name"],
        },
      },
    },
    required: ["skills", "papers"],
  };

  let extractedSetup: { skills?: string[]; papers?: Record<string, unknown>[] };

  try {
    extractedSetup = (await callLLM(
      state.model,
      setupSystemPrompt,
      setupUserPrompt,
      setupSchema,
      state.apiConfig
    )) as { skills?: string[]; papers?: Record<string, unknown>[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[LangGraph] IsolateSkills fallback:", message);
    generationWarnings.push(`Skill isolation used fallback extraction: ${message}`);
    extractedSetup = {
      skills: [
        "Full-Stack Software Engineering",
        "Systems Architecture",
        "Data Structures & Algorithms",
        "Secure API Development",
      ],
      papers: Array.from({ length: state.numPapers }, (_, i) => ({
        id: i + 1,
        name: `Paper ${i + 1}: Advanced Developer Skill Assessment`,
      })),
    };
  }

  const rawPapers = Array.isArray(extractedSetup.papers) ? extractedSetup.papers : [];
  const papers = Array.from({ length: state.numPapers }, (_, index) => {
    const paper = rawPapers[index];
    const record = paper && typeof paper === "object" ? (paper as Record<string, unknown>) : {};
    return {
      id: index + 1,
      name: String(record.name || `Paper ${index + 1}: Technical Assessment`),
    };
  });

  if (rawPapers.length < state.numPapers) {
    generationWarnings.push(
      `Model returned ${rawPapers.length} paper title(s); padded to requested ${state.numPapers}.`
    );
  }

  return {
    skills: extractedSetup.skills || [],
    papers,
    generationWarnings,
  };
}

export async function ingestTopDeveloperSkillsNode(state: GraphState) {
  const profileSystemPrompt =
    "You are a senior lead engineer profiling elite developer competencies. Outline 3 to 5 extremely advanced practices, anti-patterns, or architectural gotchas that top developers must master in this technology.";

  const profileSchema = {
    type: Type.OBJECT,
    properties: {
      competencies: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3 to 5 highly technical developer competencies or patterns",
      },
    },
    required: ["competencies"],
  };

  const profileTasks = state.skills.map((skill) => async () => {
    const profileUserPrompt = `Identify the specific skills, gotchas, and design rules of top-tier Staff/Principal developers working with: "${skill}".`;

    try {
      console.log(`[LangGraph] Profiling top developers for: "${skill}"`);
      const res = (await callLLM(
        state.model,
        profileSystemPrompt,
        profileUserPrompt,
        profileSchema,
        state.apiConfig
      )) as { competencies?: string[] };
      return { skill, competencies: res.competencies || [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[LangGraph] Profile fallback for "${skill}":`, message);
      return {
        skill,
        competencies: [
          "Enforcing SOLID design principles and decoupled modular components",
          "Configuring strict security protocols and robust error boundaries",
          "Maximizing performance metrics, memory collections, and latency limits",
        ],
      };
    }
  });

  const profileResults = await runWithConcurrencyLimit(profileTasks, MAX_PARALLEL_LLM);
  const devProfiles: Record<string, string[]> = {};
  for (const result of profileResults) {
    devProfiles[result.skill] = result.competencies;
  }

  return { developerProfiles: devProfiles };
}

function buildFallbackQuestions(
  count: number,
  startIndex: number,
  primarySkill: string
): Record<string, unknown>[] {
  const fallbackQs: Record<string, unknown>[] = [];
  for (let qIdx = 0; qIdx < count; qIdx++) {
    const qSeq = startIndex + qIdx;
    fallbackQs.push({
      id: `q_${qSeq}`,
      text: `Advanced evaluation question regarding ${primarySkill}. Identify the standard industry practice.`,
      options: [
        "A. Implement clean modular abstractions, automated test coverages, and failover pathways.",
        "B. Force tight procedural couplings and bypass standard rate limitations.",
        "C. Store sensitive API credentials in public plaintext log repositories.",
        "D. Run containers as root users with global root-write access mounts.",
      ],
      correctAnswer: "A",
      explanation:
        "Option A is correct. Decoupled concerns and active retry logic are crucial standards of premium software architecture.",
      skill: primarySkill,
      codeSnippet: "",
    });
  }
  return fallbackQs;
}

export async function synthesizeQuestionsNode(state: GraphState) {
  const chunksCount = Math.ceil(state.numQuestions / QUESTION_CHUNK_SIZE);
  const paperTasks: (() => Promise<{ paperId: number; questions: Record<string, unknown>[]; warning?: string }>)[] = [];
  const questionsGenerated: Record<number, Record<string, unknown>[]> = {};
  const papersById = new Map(state.papers.map((paper) => [paper.id, paper]));

  for (let paperId = 1; paperId <= state.numPapers; paperId++) {
    const paper = papersById.get(paperId);
    const paperName = paper?.name || `Paper ${paperId}: Technical Assessment`;

    for (let chunkIndex = 0; chunkIndex < chunksCount; chunkIndex++) {
      const questionsToGenerate =
        chunkIndex === chunksCount - 1
          ? state.numQuestions - chunkIndex * QUESTION_CHUNK_SIZE
          : QUESTION_CHUNK_SIZE;

      if (questionsToGenerate <= 0) continue;

      paperTasks.push(async () => {
        const targetKeywords = [...state.skills];
        for (const skill of state.skills) {
          targetKeywords.push(...(state.developerProfiles[skill] || []).slice(0, 2));
        }

        console.log(
          `[LangGraph RAG] Paper ${paperId} chunk ${chunkIndex + 1}/${chunksCount}`
        );

        const ragReferenceText = await retrieveRAGContext(
          state.model,
          state.segments,
          targetKeywords,
          state.apiConfig
        );

        const chunkSystemPrompt = `You are a professional software assessment compiler. Create exactly ${questionsToGenerate} multiple-choice questions for "${paperName}" evaluating top developer competencies: [${state.skills.join(", ")}].`;

        const chunkUserPrompt = `
Create exactly ${questionsToGenerate} multiple-choice questions for Paper ID ${paperId} (starting index ${chunkIndex * QUESTION_CHUNK_SIZE + 1}).

Evaluate these competencies:
${state.skills.map((s) => `- ${s}: ${state.developerProfiles[s]?.join("; ")}`).join("\n")}

Hybrid RAG syllabus context:
---
${ragReferenceText}
---

Each question must have exactly 4 options (A–D), one correct letter, a detailed explanation, and optional code snippets.
`;

        const chunkSchema = {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  skill: { type: Type.STRING },
                  codeSnippet: { type: Type.STRING },
                },
                required: ["id", "text", "options", "correctAnswer", "explanation", "skill"],
              },
            },
          },
          required: ["questions"],
        };

        try {
          const res = (await callLLM(
            state.model,
            chunkSystemPrompt,
            chunkUserPrompt,
            chunkSchema,
            state.apiConfig
          )) as { questions?: Record<string, unknown>[] };
          return { paperId, questions: res.questions || [] };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[LangGraph] Chunk synthesis failed Paper ${paperId}:`, message);
          return {
            paperId,
            warning: `Paper ${paperId} chunk ${chunkIndex + 1} used fallback questions: ${message}`,
            questions: buildFallbackQuestions(
              questionsToGenerate,
              chunkIndex * QUESTION_CHUNK_SIZE + 1,
              state.skills[0] || "Software Engineering"
            ),
          };
        }
      });
    }
  }

  console.log(
    `[LangGraph] SynthesizeQuestions: ${paperTasks.length} tasks (concurrency ${MAX_PARALLEL_LLM})`
  );
  const resolved = await runWithConcurrencyLimit(paperTasks, MAX_PARALLEL_LLM);

  for (const chunk of resolved) {
    if (!questionsGenerated[chunk.paperId]) questionsGenerated[chunk.paperId] = [];
    questionsGenerated[chunk.paperId].push(...chunk.questions);
  }

  const generationWarnings = [
    ...state.generationWarnings,
    ...resolved.map((chunk) => chunk.warning).filter((warning): warning is string => Boolean(warning)),
  ];

  return { questionsGenerated, generationWarnings };
}

export async function validateAndCorrectNode(state: GraphState) {
  const fallbackSkill = state.skills[0] || "Software Engineering";
  const generationWarnings = [...state.generationWarnings];
  const papersById = new Map(state.papers.map((paper) => [paper.id, paper]));

  const finalPapers = Array.from({ length: state.numPapers }, (_, paperIndex) => {
    const paperId = paperIndex + 1;
    const p = papersById.get(paperId);
    const rawQuestions = state.questionsGenerated[paperId] || [];
    if (rawQuestions.length < state.numQuestions) {
      generationWarnings.push(
        `Paper ${paperId} produced ${rawQuestions.length}/${state.numQuestions} questions; guarded fallback questions filled the gap.`
      );
    }

    return normalizePaper(
      {
        id: paperId,
        name: String(p?.name || `Paper ${paperId}: Technical Assessment`),
        questions: rawQuestions,
      },
      paperIndex,
      state.numQuestions,
      state.paperDurationMins,
      fallbackSkill,
      generationWarnings
    );
  });

  return { papers: finalPapers, generationWarnings };
}
