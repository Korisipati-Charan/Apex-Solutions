import dotenv from "dotenv";
import { initCache, setCacheDirectory } from "./server/llm/cache.ts";
import { getRuntimeDirectory } from "./server/runtimeDir.ts";
import { startServer } from "./server/start.ts";

dotenv.config();

setCacheDirectory(process.env.APEX_RUNTIME_DIR || getRuntimeDirectory());
initCache();

void startServer();
