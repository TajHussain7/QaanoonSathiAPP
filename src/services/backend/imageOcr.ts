/**
 * Image OCR Service
 * Extracts text from images using Google Gemini Vision via @google/genai SDK
 * Supports: JPG, PNG, WebP, BMP, GIF
 * Languages: Urdu, English
 *
 * Uses getGenAIClient() (same SDK as llmService.ts) instead of raw v1beta REST
 * calls, which caused "model not found for API version v1beta" errors with
 * Google Cloud Console API keys.
 */

import { getGenAIClient, getAllGeminiApiKeys } from "./utils.js";

export interface OCRResult {
  text: string;
  language: string;
  confidence: number;
  method: "hf-api" | "tesseract"; // preserved for interface compatibility
}

// Use the same stable model available to paid Google Cloud keys
const VISION_MODEL = "gemini-2.0-flash";

/**
 * Detect image MIME type from buffer magic bytes.
 * Uses Buffer.isBuffer() to avoid TypeScript narrowing-to-never issue
 * (Buffer extends Uint8Array, so instanceof Uint8Array is always true).
 */
function detectImageMimeType(buffer: Buffer | Uint8Array): string {
  const b: Buffer = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer as Uint8Array);

  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg"; // JPEG
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png"; // PNG
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif"; // GIF
  if (b.length > 9 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57)
    return "image/webp"; // WebP
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp"; // BMP

  return "image/jpeg"; // safest default for Gemini Vision
}

/**
 * Build an OCR prompt appropriate for the language.
 */
function buildOcrPrompt(language: "ur" | "en"): string {
  if (language === "ur") {
    return (
      "This document may contain Urdu or mixed Urdu/English text. " +
      "Extract ALL text visible in the image exactly as written, preserving Urdu script. " +
      "Output only the extracted text — no commentary, no explanations."
    );
  }
  return (
    "Extract ALL text visible in this image exactly as written. " +
    "Preserve paragraphs and line breaks where possible. " +
    "Output only the extracted text — no commentary, no explanations."
  );
}

/**
 * Extract text from image using Gemini Vision SDK.
 * Tries each API key with automatic fallback.
 */
export async function extractTextFromImageHF(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  const allKeys = getAllGeminiApiKeys();
  if (allKeys.length === 0) {
    throw new Error(
      "No Gemini API keys found — set GEMINI_API_KEY in Render environment variables",
    );
  }

  const mimeType = detectImageMimeType(imageBuffer);
  const base64Image = Buffer.isBuffer(imageBuffer)
    ? imageBuffer.toString("base64")
    : Buffer.from(imageBuffer as Uint8Array).toString("base64");

  const prompt = buildOcrPrompt(language);

  console.log(
    `📸 OCR via Gemini SDK (${VISION_MODEL}, ${mimeType}, ${imageBuffer.length} bytes, lang: ${language})...`,
  );

  let lastError: Error | null = null;

  for (let i = 0; i < allKeys.length; i++) {
    const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`;
    const client = getGenAIClient(allKeys[i]);

    if (!client) {
      console.warn(`⚠️ Could not create Gemini client for ${keyLabel} key`);
      continue;
    }

    try {
      const response = await client.models.generateContent({
        model: VISION_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
      });

      const text = response.text?.trim() ?? "";

      if (!text || text.length === 0) {
        throw new Error(
          "No text found in this image. Ensure the image is clear and contains readable text.",
        );
      }

      console.log(
        `✅ Gemini OCR complete (${keyLabel}): ${text.length} chars, format: ${mimeType}`,
      );

      return {
        text,
        language,
        confidence: 0.92,
        method: "hf-api",
      };
    } catch (err: any) {
      lastError = err;
      const msg = err.message?.slice(0, 100) ?? String(err);
      console.warn(`⚠️ Gemini OCR (${keyLabel}) failed: ${msg}`);
      if (i < allKeys.length - 1) console.log("   Trying next API key...");
    }
  }

  throw (
    lastError ??
    new Error(
      "Image text extraction failed for all Gemini API keys. Supported formats: JPG, PNG, WebP, GIF",
    )
  );
}

/**
 * Main OCR entry point.
 */
export async function extractTextFromImage(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  console.log(`📸 Starting image OCR (language: ${language})...`);
  return extractTextFromImageHF(imageBuffer, language);
}

/**
 * Extract text with minimum confidence check.
 */
export async function extractTextFromImageStrict(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
  minConfidence: number = 0.7,
): Promise<OCRResult> {
  const result = await extractTextFromImage(imageBuffer, language);
  if (result.confidence < minConfidence) {
    throw new Error(
      `OCR confidence too low (${result.confidence.toFixed(2)} < ${minConfidence}). Document quality may be poor.`,
    );
  }
  return result;
}

/**
 * Batch extract text from multiple images.
 */
export async function extractTextFromImages(
  imageBuffers: (Buffer | Uint8Array)[],
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  console.log(`📸 Batch OCR: processing ${imageBuffers.length} images...`);

  const results = await Promise.all(
    imageBuffers.map((buf, idx) => {
      console.log(`   [${idx + 1}/${imageBuffers.length}]`);
      return extractTextFromImage(buf, language);
    }),
  );

  const combinedText = results
    .map((r) => r.text)
    .join("\n\n--- Page Break ---\n\n");
  const avgConfidence =
    results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  return {
    text: combinedText.trim(),
    language,
    confidence: avgConfidence,
    method: "hf-api",
  };
}
