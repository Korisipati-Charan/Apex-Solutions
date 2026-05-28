import type { GraphState, NodeFunction } from "./types.ts";

export class StateGraph {
  private nodes: Record<string, NodeFunction> = {};
  private edges: Record<string, string> = {};
  private initialNode = "";

  addNode(name: string, fn: NodeFunction): void {
    this.nodes[name] = fn;
  }

  addEdge(fromNode: string, toNode: string): void {
    this.edges[fromNode] = toNode;
  }

  setEntryPoint(name: string): void {
    this.initialNode = name;
  }

  async run(initialState: GraphState): Promise<GraphState> {
    let currentStateName = this.initialNode;
    let state = { ...initialState };

    console.log(`[LangGraph Engine] Starting at entry point: "${currentStateName}"`);

    while (currentStateName) {
      const nodeFn = this.nodes[currentStateName];
      if (!nodeFn) {
        throw new Error(`[LangGraph Engine] Node "${currentStateName}" is not defined.`);
      }

      console.log(`[LangGraph Engine] Entering node: "${currentStateName}"`);
      try {
        const stateUpdates = await nodeFn(state);
        state = { ...state, ...stateUpdates };
        console.log(`[LangGraph Engine] Completed node: "${currentStateName}"`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[LangGraph Engine] Crash in "${currentStateName}":`, message);
        state.errors.push(`Node "${currentStateName}" failed: ${message}`);
        throw err;
      }

      currentStateName = this.edges[currentStateName];
    }

    console.log("[LangGraph Engine] Graph execution finished successfully.");
    return state;
  }
}
