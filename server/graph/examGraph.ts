import { StateGraph } from "./StateGraph.ts";
import {
  ingestTopDeveloperSkillsNode,
  isolateSkillsNode,
  segmentSyllabusNode,
  synthesizeQuestionsNode,
  validateAndCorrectNode,
} from "./nodes.ts";
import type { GraphState } from "./types.ts";

export function buildExamGenerationGraph(): StateGraph {
  const graph = new StateGraph();

  graph.addNode("SegmentSyllabus", segmentSyllabusNode);
  graph.addNode("IsolateSkills", isolateSkillsNode);
  graph.addNode("IngestTopDeveloperSkills", ingestTopDeveloperSkillsNode);
  graph.addNode("SynthesizeQuestions", synthesizeQuestionsNode);
  graph.addNode("ValidateAndCorrect", validateAndCorrectNode);

  graph.setEntryPoint("SegmentSyllabus");
  graph.addEdge("SegmentSyllabus", "IsolateSkills");
  graph.addEdge("IsolateSkills", "IngestTopDeveloperSkills");
  graph.addEdge("IngestTopDeveloperSkills", "SynthesizeQuestions");
  graph.addEdge("SynthesizeQuestions", "ValidateAndCorrect");

  return graph;
}

export async function runExamGenerationGraph(initialState: GraphState): Promise<GraphState> {
  const graph = buildExamGenerationGraph();
  return graph.run(initialState);
}
