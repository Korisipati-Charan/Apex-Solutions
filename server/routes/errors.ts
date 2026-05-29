import type { Response } from "express";

export interface ApiErrorPayload {
  ok: false;
  error: string;
  code?: string;
}

export function sendApiError(
  res: Response,
  status: number,
  error: string,
  code?: string
): void {
  const payload: ApiErrorPayload = code ? { ok: false, error, code } : { ok: false, error };
  res.status(status).json(payload);
}
