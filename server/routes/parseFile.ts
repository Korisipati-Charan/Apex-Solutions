import type { Request, Response } from "express";
import path from "path";

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

  if (!base64Data) {
    res.status(400).json({ error: "File data is required." });
    return;
  }

  const buffer = Buffer.from(base64Data, "base64");
  const ext = path.extname(fileName || "").toLowerCase();
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
        extractedText = `[Word Parsing Fallback Content]\n\n${extractPrintableText(buffer)}`;
      }
    } else if (ext === ".doc") {
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
          extractedText = `[Binary/Visual Content from: ${fileName}]\n\n${extractPrintableText(buffer)}`;
        }
      } catch {
        extractedText = `[Binary/Visual Content from: ${fileName}]\n\n${extractPrintableText(buffer)}`;
      }
    }

    res.json({ ok: true, text: extractedText });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Parse File Error]:", message);
    res.json({
      ok: true,
      text: `[Fatal parsing error on ${fileName}. Recovered raw data:]\n\n${extractPrintableText(buffer)}`,
    });
  }
}
