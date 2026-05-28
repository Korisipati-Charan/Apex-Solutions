import path from "path";
import { fileURLToPath } from "url";

export function getRuntimeDirectory(): string {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }

  if (process.env.NODE_ENV !== "production") {
    return path.dirname(fileURLToPath(import.meta.url));
  }

  return process.cwd();
}
