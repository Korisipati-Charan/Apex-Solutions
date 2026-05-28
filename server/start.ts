import path from "path";
import { createApp } from "./app.ts";
import { getRuntimeDirectory } from "./runtimeDir.ts";

const PORT = Number(process.env.PORT) || 3000;

export async function startServer(): Promise<void> {
  const app = createApp();
  const serverRoot = getRuntimeDirectory();

  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = serverRoot;
    const express = (await import("express")).default;
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Binary Core] Standalone Environment booting on port ${PORT}`);
  });
}
