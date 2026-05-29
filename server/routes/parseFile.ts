import type { Request, Response } from "express";
import path from "path";
import { sendApiError } from "./errors.ts";

const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt", ".md", ".prompt"]);
const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = Number(process.env.APEX_MAX_FILE_BYTES) || DEFAULT_MAX_FILE_BYTES;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function extractPrintableText(buffer: Buffer): string {
  try {
    const rawString = buffer.toString("binary");
    const matches = rawString.match(/[\x20-\x7E\t\r\n]{4,}/g);
    if (matches && matches.length > 0) {
      return matches.map((m) => m.trim()).filter(Boolean).join("\n");
    }
  } catch {
    // Fall through
  }
  return "[No printable text characters discovered in the file binary data]";
}

export async function handleParseFile(req: Request, res: Response): Promise<void> {
  const { base64Data, fileName } = req.body as { base64Data?: string; fileName?: string };
  const warnings: string[] = [];

  if (!base64Data) {
    sendApiError(res, 400, "File data is required.", "FILE_DATA_REQUIRED");
    return;
  }

  if (typeof base64Data !== "string" || !BASE64_PATTERN.test(base64Data.replace(/\s/g, ""))) {
    sendApiError(res, 400, "File data must be valid base64 content.", "INVALID_FILE_DATA");
    return;
  }

  if (!fileName || typeof fileName !== "string") {
    sendApiError(res, 400, "File name is required.", "FILE_NAME_REQUIRED");
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    sendApiError(res, 415, "Unsupported file type. Upload PDF, Word, text, markdown, or prompt files.", "UNSUPPORTED_FILE_TYPE");
    return;
  }

  const normalizedBase64 = base64Data.replace(/\s/g, "");
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (buffer.length === 0) {
    sendApiError(res, 400, "Uploaded file is empty.", "EMPTY_FILE");
    return;
  }

  if (buffer.length > MAX_FILE_BYTES) {
    sendApiError(
      res,
      413,
      `Uploaded file is too large. Maximum accepted file size is ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB.`,
      "FILE_TOO_LARGE"
    );
    return;
  }

  let extractedText = "";

  try {
    if (ext === ".pdf") {
      try {
        const pdfParseModule: unknown = await import("pdf-parse");
        if (typeof pdfParseModule === "function") {
          const data = await (pdfParseModule as (buf: Buffer) => Promise<{ text: string }>)(buffer);
          extractedText = data.text;
        } else if (
          pdfParseModule &&
          typeof pdfParseModule === "object" &&
          typeof (pdfParseModule as { PDFParse?: unknown }).PDFParse === "function"
        ) {
          const PDFParse = (pdfParseModule as {
            PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> };
          }).PDFParse;
          const instance = new PDFParse({ data: buffer });
          const data = await instance.getText();
          extractedText = data.text;
        } else if (typeof pdfParseModule === "object" && pdfParseModule !== null) {
          const legacyParser = (pdfParseModule as { default?: unknown }).default ?? pdfParseModule;
          if (typeof legacyParser === "function") {
            const data = await (legacyParser as (buf: Buffer) => Promise<{ text: string }>)(buffer);
            extractedText = data.text;
          } else {
            throw new Error("Invalid PDF parser module structure.");
          }
        } else {
          throw new Error("Invalid PDF parser module structure.");
        }
      } catch (pdfErr: unknown) {
        const message = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        console.warn(`[PDF Parser Fallback] ${fileName}:`, message);
        warnings.push(`PDF parser fallback used for ${fileName}: ${message}`);
        extractedText = `[PDF Parsing Fallback Content]\n\n${extractPrintableText(buffer)}`;
      }
    } else if (ext === ".docx") {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } catch (docxErr: unknown) {
        const message = docxErr instanceof Error ? docxErr.message : String(docxErr);
        console.warn(`[DOCX Parser Fallback] ${fileName}:`, message);
        warnings.push(`Word parser fallback used for ${fileName}: ${message}`);
        extractedText = `[Word Parsing Fallback Content]\n\n${extractPrintableText(buffer)}`;
      }
    } else if (ext === ".doc") {
      warnings.push("Legacy .doc parsing uses printable-text fallback extraction.");
      extractedText = `[Legacy Word (.doc) Extracted Content]\n\n${extractPrintableText(buffer)}`;
    } else {
      try {
        const rawUtf8 = buffer.toString("utf-8");
        const binaryChars = [...rawUtf8].filter((c) => {
          const code = c.charCodeAt(0);
          return code < 32 && c !== "\n" && c !== "\r" && c !== "\t";
        }).length;

        if (binaryChars / rawUtf8.length < 0.05) {
          extractedText = rawUtf8;
        } else {
          warnings.push(`Binary-looking text fallback used for ${fileName}.`);
          extractedText = `[Binary/Visual Content from: ${fileName}]\n\n${extractPrintableText(buffer)}`;
        }
      } catch {
        warnings.push(`UTF-8 decoding failed; printable-text fallback used for ${fileName}.`);
        extractedText = `[Binary/Visual Content from: ${fileName}]\n\n${extractPrintableText(buffer)}`;
      }
    }

    res.json({ ok: true, text: extractedText, warnings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Parse File Error]:", message);
    res.json({
      ok: false,
      text: `[Fatal parsing error on ${fileName}. Recovered raw data:]\n\n${extractPrintableText(buffer)}`,
      warnings: [`Fatal parser fallback used for ${fileName}: ${message}`],
      error: message,
    });
  }
}
