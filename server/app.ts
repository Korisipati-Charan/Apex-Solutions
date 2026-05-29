import express from "express";
import { registerApiRoutes } from "./routes/api.ts";
import { sendApiError } from "./routes/errors.ts";

const REQUEST_BODY_LIMIT = process.env.APEX_REQUEST_BODY_LIMIT || "30mb";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "apex-solutions",
      status: "healthy",
      uptimeSecs: Math.round(process.uptime()),
    });
  });

  registerApiRoutes(app);

  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const isPayloadTooLarge =
      typeof err === "object" &&
      err !== null &&
      "type" in err &&
      (err as { type?: unknown }).type === "entity.too.large";

    if (isPayloadTooLarge) {
      sendApiError(
        res,
        413,
        `Request body is too large. Maximum accepted payload is ${REQUEST_BODY_LIMIT}.`,
        "REQUEST_BODY_TOO_LARGE"
      );
      return;
    }

    const isMalformedJson =
      typeof err === "object" &&
      err !== null &&
      "type" in err &&
      (err as { type?: unknown }).type === "entity.parse.failed";

    if (isMalformedJson) {
      sendApiError(res, 400, "Request body must be valid JSON.", "INVALID_JSON");
      return;
    }

    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[Express Error]:", message);
    sendApiError(res, 500, "Unexpected server error.", "INTERNAL_SERVER_ERROR");
  });

  return app;
}
