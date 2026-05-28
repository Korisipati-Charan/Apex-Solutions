import crypto from "crypto";
import { Type } from "@google/genai";
import { callLLM } from "../llm/router.ts";
import type { ApiConfig } from "../llm/router.ts";

const LEXICAL_DOMINANCE_RATIO = 2;
const RAG_CACHE_MAX = 128;

const ragContextCache = new Map<string, string>();

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

export function segmentSyllabusText(text: string, chunkSize = 1200, overlap = 250): string[] {
  const segments: string[] = [];
  let index = 0;
  while (index < text.length) {
    segments.push(text.slice(index, index + chunkSize));
    index += chunkSize - overlap;
  }
  return segments.length > 0 ? segments : [text];
}

export function scoreLexicalBM25(segment: string, keywords: string[]): number {
  const cleanSegment = segment.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    const term = kw.toLowerCase().trim();
    if (!term || term.length < 2) continue;

    const occurrences = countOccurrences(cleanSegment, term);
    if (occurrences > 0) {
      score += occurrences / (occurrences + 1.5);
    }
  }

  return score;
}

function buildRagCacheKey(keywords: string[], segmentFingerprints: string[]): string {
  const normalizedKeywords = [...keywords].map((k) => k.toLowerCase().trim()).sort();
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ keywords: normalizedKeywords, segments: segmentFingerprints }))
    .digest("hex");
}

function rememberRagContext(key: string, value: string): string {
  if (ragContextCache.size >= RAG_CACHE_MAX) {
    const oldestKey = ragContextCache.keys().next().value;
    if (oldestKey) ragContextCache.delete(oldestKey);
  }
  ragContextCache.set(key, value);
  return value;
}

export async function retrieveRAGContext(
  model: string,
  segments: string[],
  keywords: string[],
  apiConfig: ApiConfig
): Promise<string> {
  if (segments.length === 0) return "";

  const lexicalScores = segments.map((seg, idx) => ({
    index: idx,
    segment: seg,
    lexicalScore: scoreLexicalBM25(seg, keywords),
  }));

  const topLexical = lexicalScores.sort((a, b) => b.lexicalScore - a.lexicalScore).slice(0, 5);
  if (topLexical.length === 0) return segments[0] || "";

  if (topLexical[0].lexicalScore === 0) {
    const midIdx = Math.floor(segments.length / 2);
    return segments[midIdx] || segments[0];
  }

  const segmentFingerprints = topLexical.map((item) =>
    crypto.createHash("sha1").update(item.segment.slice(0, 120)).digest("hex")
  );
  const cacheKey = buildRagCacheKey(keywords, segmentFingerprints);
  const cached = ragContextCache.get(cacheKey);
  if (cached) {
    console.log("[RAG Engine] Context cache HIT");
    return cached;
  }

  const runnerUpScore = topLexical[1]?.lexicalScore ?? 0;
  if (
    topLexical.length >= 2 &&
    topLexical[0].lexicalScore > 0 &&
    topLexical[0].lexicalScore / Math.max(runnerUpScore, 0.001) >= LEXICAL_DOMINANCE_RATIO
  ) {
    console.log(
      `[RAG Engine] Skipping semantic pass — dominant lexical match (score ${topLexical[0].lexicalScore.toFixed(3)})`
    );
    return rememberRagContext(cacheKey, topLexical[0].segment);
  }

  const candidateTexts = topLexical
    .map((item, idx) => `[Segment ID: ${idx}]\n${item.segment}`)
    .join("\n\n---\n\n");

  const semanticSystemPrompt =
    "You are a senior computer science data retriever. Identify which candidate segment contains the most relevant technical details for the target skills.";
  const semanticUserPrompt = `
Target Technical Keywords: [${keywords.join(", ")}]

Candidate Segments:
${candidateTexts}

Reply in strict JSON format:
{
  "bestSegmentIndex": <integer from 0 to ${topLexical.length - 1}>
}
`;

  const semanticSchema = {
    type: Type.OBJECT,
    properties: {
      bestSegmentIndex: { type: Type.INTEGER, description: "Index of the best matched segment" },
    },
    required: ["bestSegmentIndex"],
  };

  try {
    console.log(`[RAG Engine] Semantic filtering for: [${keywords.slice(0, 3).join(", ")}...]`);
    const rankResult = (await callLLM(
      model,
      semanticSystemPrompt,
      semanticUserPrompt,
      semanticSchema,
      apiConfig
    )) as { bestSegmentIndex?: number };

    const selectedIdx = rankResult.bestSegmentIndex ?? 0;
    const bestMatch = topLexical[selectedIdx] || topLexical[0];
    console.log(
      `[RAG Engine] Selected segment ${selectedIdx} (lexical score ${bestMatch.lexicalScore.toFixed(3)})`
    );
    return rememberRagContext(cacheKey, bestMatch.segment);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[RAG Engine] Semantic selection failed, using top lexical chunk:", message);
    return rememberRagContext(cacheKey, topLexical[0].segment);
  }
}
