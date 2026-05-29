import fs from "fs";
import path from "path";
import crypto from "crypto";

let cacheFile = path.join(process.cwd(), ".llm_cache.json");

export function setCacheDirectory(baseDir: string): void {
  fs.mkdirSync(baseDir, { recursive: true });
  cacheFile = path.join(baseDir, ".llm_cache.json");
}
const FLUSH_DEBOUNCE_MS = 2000;
const MAX_CACHE_ENTRIES = 500;
const CACHE_VERSION = 2;

interface DiskCachePayload {
  version: number;
  entries: Record<string, unknown>;
}

let llmCache: Record<string, unknown> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cacheInitialized = false;

export function initCache(): void {
  if (cacheInitialized) return;
  cacheInitialized = true;

  try {
    if (fs.existsSync(cacheFile)) {
      const parsed = JSON.parse(fs.readFileSync(cacheFile, "utf-8")) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as DiskCachePayload).version === CACHE_VERSION &&
        (parsed as DiskCachePayload).entries &&
        typeof (parsed as DiskCachePayload).entries === "object"
      ) {
        llmCache = (parsed as DiskCachePayload).entries;
      } else {
        console.warn("[LLM Cache] Cache version mismatch; starting a fresh cache.");
        llmCache = {};
      }
      console.log(`[LLM Cache] Loaded ${Object.keys(llmCache).length} cached entries from disk.`);
    }
  } catch (e) {
    console.warn("[LLM Cache] Failed to load disk cache on boot, starting fresh:", e);
    try {
      fs.renameSync(cacheFile, `${cacheFile}.corrupt-${Date.now()}`);
    } catch {
      // Ignore backup failures; the in-memory cache is still reset safely.
    }
    llmCache = {};
  }
}

function trimCacheIfNeeded(): void {
  const keys = Object.keys(llmCache);
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  const excess = keys.length - MAX_CACHE_ENTRIES;
  for (let i = 0; i < excess; i++) {
    delete llmCache[keys[i]];
  }
}

async function flushCacheToDisk(): Promise<void> {
  try {
    const payload: DiskCachePayload = {
      version: CACHE_VERSION,
      entries: llmCache,
    };
    await fs.promises.writeFile(cacheFile, JSON.stringify(payload), "utf-8");
  } catch (e) {
    console.error("[LLM Cache] Failed to write cache to disk:", e);
  }
}

export function scheduleCacheFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushCacheToDisk();
  }, FLUSH_DEBOUNCE_MS);
}

export function computeCacheKey(
  systemInstruction: string,
  userPrompt: string,
  modelName: string,
  responseSchema?: unknown
): string {
  const data = JSON.stringify({
    systemInstruction,
    userPrompt,
    modelName,
    responseSchema: responseSchema ?? null,
    cacheVersion: CACHE_VERSION,
  });
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function getCachedResponse(cacheKey: string): unknown | undefined {
  return llmCache[cacheKey];
}

export function setCachedResponse(cacheKey: string, value: unknown): void {
  llmCache[cacheKey] = value;
  trimCacheIfNeeded();
  scheduleCacheFlush();
}
