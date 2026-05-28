import express from "express";
import { registerApiRoutes } from "./routes/api.ts";

export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  registerApiRoutes(app);

  return app;
}
