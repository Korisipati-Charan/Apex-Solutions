import dotenv from "dotenv";
import { initCache, setCacheDirectory } from "./server/llm/cache.ts";
import { getRuntimeDirectory } from "./server/runtimeDir.ts";
import { startServer } from "./server/start.ts";

dotenv.config();

setCacheDirectory(getRuntimeDirectory());
initCache();

void startServer();
