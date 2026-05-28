import { Paper, PaperResponseState } from "../types";

/** Build paper response slots aligned with generated papers (UI supports 1–2 papers). */
export function buildInitialPaperResponses(
  papers: Pick<Paper, "id">[],
  paperDurationMins: number
): Record<number, PaperResponseState> {
  const responses: Record<number, PaperResponseState> = {};

  papers.forEach((paper, index) => {
    responses[paper.id] = {
      paperId: paper.id,
      answers: {},
      timeRemainingSecs: paperDurationMins * 60,
      status: index === 0 ? "ongoing" : "not_started",
      timeSpentSecs: 0,
      ...(index === 0 ? { startedAt: new Date().toISOString() } : {}),
    };
  });

  return responses;
}

export function paperAnswersMap(
  paperResponses: Record<number, PaperResponseState>
): Record<number, PaperResponseState["answers"]> {
  return Object.fromEntries(
    Object.entries(paperResponses).map(([paperId, state]) => [Number(paperId), state.answers])
  );
}
