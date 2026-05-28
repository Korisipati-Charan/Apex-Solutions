import type { UiPaper, UiQuestion } from "../../shared/apiContract.ts";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export function normalizeLetterAnswer(value: unknown): "A" | "B" | "C" | "D" {
  if (typeof value !== "string") return "A";
  const match = value.trim().toUpperCase().match(/^([A-D])/);
  return (match?.[1] as "A" | "B" | "C" | "D") || "A";
}

export function normalizeOptions(raw: unknown): [string, string, string, string] {
  let options: string[] = [];

  if (Array.isArray(raw)) {
    options = raw.map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && "text" in entry) {
        return String((entry as { text: unknown }).text).trim();
      }
      return String(entry).trim();
    });
  }

  const normalized = OPTION_LETTERS.map((letter, index) => {
    const opt = options[index] || "";
    const stripped = opt.replace(/^[A-D][\.\)\:\-\s]*/i, "").trim();
    return stripped || `Option ${letter}`;
  });

  return normalized as [string, string, string, string];
}

export function normalizeQuestion(
  raw: Record<string, unknown>,
  index: number,
  fallbackSkill: string
): UiQuestion {
  const codeSnippet = raw.codeSnippet ? String(raw.codeSnippet).trim() : undefined;

  return {
    id: `q_${index + 1}`,
    text: String(raw.text || `Assessment question ${index + 1}`).trim(),
    options: normalizeOptions(raw.options),
    correctAnswer: normalizeLetterAnswer(raw.correctAnswer),
    explanation: String(
      raw.explanation || "The correct choice follows standard industry practice for this skill."
    ).trim(),
    skill: String(raw.skill || fallbackSkill).trim(),
    ...(codeSnippet ? { codeSnippet } : {}),
  };
}

export function normalizePaper(
  raw: Record<string, unknown>,
  paperIndex: number,
  numQuestions: number,
  durationMins: number,
  fallbackSkill: string
): UiPaper {
  const id =
    typeof raw.id === "number" && Number.isFinite(raw.id) ? Math.floor(raw.id) : paperIndex + 1;
  const questionsRaw = Array.isArray(raw.questions) ? raw.questions : [];

  const questions: UiQuestion[] = questionsRaw
    .slice(0, numQuestions)
    .map((q, idx) => normalizeQuestion(q as Record<string, unknown>, idx, fallbackSkill));

  while (questions.length < numQuestions) {
    questions.push(
      normalizeQuestion(
        {
          text: `Technical evaluation for ${fallbackSkill}. Select the industry-standard approach.`,
          options: [
            "Apply modular design, automated testing, and resilient error handling.",
            "Tightly couple services and bypass validation layers.",
            "Store secrets in client-side plaintext configuration.",
            "Disable sandboxing and run all processes with elevated privileges.",
          ],
          correctAnswer: "A",
          explanation: "Modular, tested, and resilient designs are the accepted professional standard.",
          skill: fallbackSkill,
        },
        questions.length,
        fallbackSkill
      )
    );
  }

  return {
    id,
    name: String(raw.name || `Paper ${id}: Technical Assessment`).trim(),
    questions,
    durationMins,
  };
}

export function normalizeGenerateExamResponse(
  data: { skills?: unknown; papers?: unknown },
  numPapers: number,
  numQuestions: number,
  paperDurationMins: number
): { skills: string[]; papers: UiPaper[] } {
  const skills = Array.isArray(data.skills)
    ? data.skills.map((s) => String(s).trim()).filter(Boolean)
    : ["Software Engineering"];

  const fallbackSkill = skills[0] || "Software Engineering";
  const papersRaw = Array.isArray(data.papers) ? data.papers : [];
  const papers: UiPaper[] = [];

  for (let i = 0; i < numPapers; i++) {
    const raw = (papersRaw[i] as Record<string, unknown>) || { id: i + 1 };
    papers.push(normalizePaper(raw, i, numQuestions, paperDurationMins, fallbackSkill));
  }

  return { skills, papers };
}

/** Normalize candidate answer the same way the terminal stores selections (A–D). */
export function normalizeCandidateAnswer(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return normalizeLetterAnswer(String(value));
}
