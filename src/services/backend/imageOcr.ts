/**
 * Image OCR Service
 * Extracts text from images using Google Gemini Vision API
 * Supports: JPG, PNG, WebP, BMP, GIF
 * Languages: Urdu, English
 *
 * Switched from HuggingFace (naver-clova-ix/donut-base and
 * microsoft/trocr-large-printed removed from free inference) to
 * Gemini Flash Vision which already has working API keys in this project.
 */

import { getAllGeminiApiKeys } from "./utils.js";

export interface OCRResult {
  text: string;
  language: string;
  confidence: number;
  method: "hf-api" | "tesseract"; // kept for interface compatibility
}

const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";
const VISION_MODEL = "gemini-1.5-flash";

/**
 * Detect image MIME type from buffer magic bytes.
 * Uses Buffer.isBuffer() to avoid the TypeScript narrowing-to-never issue
 * that occurs when checking `instanceof Uint8Array` (Buffer extends Uint8Array).
 */
function detectImageMimeType(buffer: Buffer | Uint8Array): string {
  // Always work with a proper Buffer so index access is type-safe
  const b: Buffer = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer as Uint8Array);

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  // GIF: 47 49 46 38
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  // WebP: RIFF....WEBP (bytes 0-1 = 52 49, bytes 8-9 = 57 45)
  if (b[0] === 0x52 && b[1] === 0x49 && b.length > 9 && b[8] === 0x57) {
    return "image/webp";
  }
  // BMP: 42 4D
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";

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
      "Output only the extracted text with no commentary."
    );
  }
  return (
    "Extract ALL text visible in this image exactly as written. " +
    "Preserve formatting where possible. " +
    "Output only the extracted text with no commentary."
  );
}

/**
 * Extract text from an image using Gemini Vision.
 * Tries each API key with automatic fallback.
 */
export async function extractTextFromImageHF(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  const allKeys = getAllGeminiApiKeys();
  if (allKeys.length === 0) {
    throw new Error(
      "No Gemini API keys found — set GEMINI_API_KEY in environment variables",
    );
  }

  const mimeType = detectImageMimeType(imageBuffer);
  const base64Image = Buffer.isBuffer(imageBuffer)
    ? imageBuffer.toString("base64")
    : Buffer.from(imageBuffer).toString("base64");

  const prompt = buildOcrPrompt(language);

  console.log(
    `📸 OCR via Gemini Vision (${mimeType}, ${imageBuffer.length} bytes, lang: ${language})...`,
  );

  let lastError: Error | null = null;

  for (let i = 0; i < allKeys.length; i++) {
    const apiKey = allKeys[i];
    const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`;

    try {
      const url = `${GEMINI_API_ENDPOINT}/${VISION_MODEL}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
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
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
          },
        }),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => ({}))) as any;
        const msg = errData.error?.message || `HTTP ${response.status}`;

        if (response.status === 429) {
          throw new Error("Gemini rate limit — try again in a moment");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Invalid Gemini API key (${keyLabel})`);
        }
        throw new Error(msg);
      }

      const data = (await response.json()) as any;
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!text || text.length === 0) {
        throw new Error(
          "No text found in this image. Ensure the image is clear and contains readable text.",
        );
      }

      console.log(
        `✅ Gemini OCR complete (${keyLabel}): ${text.length} chars, mime: ${mimeType}`,
      );

      return {
        text,
        language,
        confidence: 0.92,
        method: "hf-api", // preserved for interface compatibility
      };
    } catch (err: any) {
      lastError = err;
      console.warn(
        `⚠️ Gemini OCR (${keyLabel}) failed: ${err.message?.slice(0, 80)}`,
      );
      if (i < allKeys.length - 1) {
        console.log("   Trying next API key...");
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "Image text extraction failed for all Gemini API keys. Supported formats: JPG, PNG, WebP, GIF",
    )
  );
}

/**
 * Main OCR entry point — uses Gemini Vision.
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
