import path from "path";

/**
 * Resolves the directory containing the running server bundle.
 * - `dist/server.cjs` (esbuild CJS): uses Node-injected `__dirname` → `dist/`
 * - `tsx server.ts` (dev): tsx also provides `__dirname` at project root
 */
export function getRuntimeDirectory(): string {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  return path.resolve(".");
}
