import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { traceable } from "langsmith/traceable";
import {
  ingestTopDeveloperSkillsNode,
  isolateSkillsNode,
  segmentSyllabusNode,
  synthesizeQuestionsNode,
  validateAndCorrectNode,
} from "./nodes.ts";
import type { GraphState, NodeFunction } from "./types.ts";

const ExamGraphState = Annotation.Root({
  documentText: Annotation<GraphState["documentText"]>(),
  numPapers: Annotation<GraphState["numPapers"]>(),
  numQuestions: Annotation<GraphState["numQuestions"]>(),
  paperDurationMins: Annotation<GraphState["paperDurationMins"]>(),
  model: Annotation<GraphState["model"]>(),
  apiConfig: Annotation<GraphState["apiConfig"]>(),
  skills: Annotation<GraphState["skills"]>(),
  papers: Annotation<GraphState["papers"]>(),
  segments: Annotation<GraphState["segments"]>(),
  developerProfiles: Annotation<GraphState["developerProfiles"]>(),
  questionsGenerated: Annotation<GraphState["questionsGenerated"]>(),
  errors: Annotation<GraphState["errors"]>(),
  generationWarnings: Annotation<GraphState["generationWarnings"]>(),
});

function traceNode(name: string, fn: NodeFunction) {
  const traced = traceable(
    async (state: GraphState) => {
      console.log(`[LangGraph Engine] Entering node: "${name}"`);
      try {
        const result = await fn(state);
        console.log(`[LangGraph Engine] Completed node: "${name}"`);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[LangGraph Engine] Crash in "${name}":`, message);
        throw err;
      }
    },
    {
      name: `Apex.${name}`,
      run_type: "chain",
      tags: ["apex", "exam-generation", name],
      processInputs: (inputs) => {
        const state = inputs as Partial<GraphState>;
        return {
          model: state.model,
          numPapers: state.numPapers,
          numQuestions: state.numQuestions,
          paperDurationMins: state.paperDurationMins,
          documentChars:
            typeof state.documentText === "string" ? state.documentText.length : undefined,
          skillsCount: Array.isArray(state.skills) ? state.skills.length : undefined,
          segmentCount: Array.isArray(state.segments) ? state.segments.length : undefined,
        };
      },
    }
  );

  return async (state: typeof ExamGraphState.State) =>
    traced(state as GraphState) as Promise<Partial<GraphState>>;
}

export function buildExamGenerationGraph() {
  const graph = new StateGraph(ExamGraphState);

  return graph
    .addNode("SegmentSyllabus", traceNode("SegmentSyllabus", segmentSyllabusNode))
    .addNode("IsolateSkills", traceNode("IsolateSkills", isolateSkillsNode))
    .addNode("IngestTopDeveloperSkills", traceNode("IngestTopDeveloperSkills", ingestTopDeveloperSkillsNode))
    .addNode("SynthesizeQuestions", traceNode("SynthesizeQuestions", synthesizeQuestionsNode))
    .addNode("ValidateAndCorrect", traceNode("ValidateAndCorrect", validateAndCorrectNode))
    .addEdge(START, "SegmentSyllabus")
    .addEdge("SegmentSyllabus", "IsolateSkills")
    .addEdge("IsolateSkills", "IngestTopDeveloperSkills")
    .addEdge("IngestTopDeveloperSkills", "SynthesizeQuestions")
    .addEdge("SynthesizeQuestions", "ValidateAndCorrect")
    .addEdge("ValidateAndCorrect", END)
    .compile();
}

export async function runExamGenerationGraph(initialState: GraphState): Promise<GraphState> {
  const graph = buildExamGenerationGraph();
  console.log("[LangGraph Engine] Starting Apex exam generation graph.");
  const result = await graph.invoke(initialState, {
    runName: "Apex Exam Generation",
    tags: ["apex", "langgraph", "hybrid-rag"],
  });
  console.log("[LangGraph Engine] Graph execution finished successfully.");
  return result as GraphState;
}
