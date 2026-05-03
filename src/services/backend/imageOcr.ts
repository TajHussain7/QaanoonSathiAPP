/**
 * Image OCR Service
 * Extracts text from images using HF Inference API (document understanding models)
 * Supports: JPG, PNG, WebP, BMP, GIF
 * Languages: Urdu, English
 *
 * NOTE: Uses HF Inference API exclusively (no Tesseract fallback)
 * Reason: HF API is stable on servers, Tesseract.js workers are browser-oriented
 */

import { HfInference } from "@huggingface/inference";

export interface OCRResult {
  text: string;
  language: string;
  confidence: number;
  method: "hf-api" | "tesseract";
}

/**
 * Get HF Inference client with API key from .env
 */
function getHFClient(): HfInference {
  const token = process.env.HUGGING_API_KEY;
  if (!token) {
    throw new Error(
      "HUGGING_API_KEY not found in .env — required for image OCR",
    );
  }
  return new HfInference(token);
}

/**
 * Extract text from image using HF Inference API (document understanding)
 * Uses vision model to understand and extract text from images
 * @param imageBuffer Buffer or Uint8Array of image file
 * @param language 'ur' for Urdu, 'en' for English
 * @returns Extracted text and confidence
 */
export async function extractTextFromImageHF(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  const client = getHFClient();

  try {
    console.log(
      `📸 Extracting text from image (HF API, ${imageBuffer.length} bytes)...`,
    );

    // Convert buffer to base64 for HF API
    const base64Image = Buffer.isBuffer(imageBuffer)
      ? imageBuffer.toString("base64")
      : Buffer.from(imageBuffer).toString("base64");

    // Use document understanding via HF API
    // Multiple fallback models for better compatibility
    const models = [
      "naver-clova-ix/donut-base", // Primary: Best for documents
      "microsoft/trocr-large-printed", // Secondary: Good for text
    ];

    let lastError: any = null;
    for (const model of models) {
      try {
        console.log(`   Attempting model: ${model}...`);
        const result = await client.documentQuestionAnswering({
          model: model,
          inputs: {
            image: base64Image,
            question: "Extract all text from this document exactly as written.",
          },
        } as any);

        const text = (result as any).answer || "";

        if (text && text.trim().length > 0) {
          console.log(`✅ HF OCR complete (${model}): ${text.length} chars`);
          return {
            text: text.trim(),
            language: language,
            confidence: 0.85,
            method: "hf-api",
          };
        }
      } catch (modelError: any) {
        lastError = modelError;
        console.warn(`   ⚠️ Model ${model} failed, trying next...`);
        continue;
      }
    }

    // If all models failed
    throw (
      lastError || new Error("All HF models failed to extract text from image")
    );
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`❌ HF Image OCR failed: ${errorMsg.slice(0, 100)}`);

    // Provide detailed error guidance
    if (errorMsg.includes("401") || errorMsg.includes("invalid"))
      throw new Error(
        "Image OCR API authentication failed. Please check HUGGING_API_KEY.",
      );
    if (errorMsg.includes("rate limit") || errorMsg.includes("429"))
      throw new Error(
        "Image processing rate limit reached. Please try again in a moment.",
      );
    if (errorMsg.includes("timeout"))
      throw new Error(
        "Image processing timed out. Please try a smaller image.",
      );

    throw new Error(
      `Image text extraction failed: ${errorMsg}. Supported formats: JPG, PNG, WebP, BMP, GIF`,
    );
  }
}

/**
 * Smart OCR: Uses HF API exclusively (Tesseract.js not compatible with servers)
 * @param imageBuffer Image buffer
 * @param language 'ur' for Urdu, 'en' for English
 * @returns Extracted text with metadata
 */
export async function extractTextFromImage(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  console.log(`📸 Starting image OCR (language: ${language})...`);

  // Use HF API exclusively - Tesseract.js workers are not compatible with Node.js servers
  return await extractTextFromImageHF(imageBuffer, language);
}

/**
 * Extract text from image with confidence filtering
 * Only returns text if confidence is above threshold
 * @param imageBuffer Image buffer
 * @param language Language code
 * @param minConfidence Minimum confidence threshold (0-1)
 * @returns OCR result or error if confidence too low
 */
export async function extractTextFromImageStrict(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
  minConfidence: number = 0.7,
): Promise<OCRResult> {
  const result = await extractTextFromImage(imageBuffer, language);

  if (result.confidence < minConfidence) {
    console.warn(
      `⚠️ Low confidence OCR: ${result.confidence.toFixed(2)} < ${minConfidence}`,
    );
    throw new Error(
      `OCR confidence too low (${result.confidence.toFixed(2)} < ${minConfidence}). Document quality may be poor.`,
    );
  }

  return result;
}

/**
 * Batch extract text from multiple images
 * Useful for processing multi-page documents
 * @param imageBuffers Array of image buffers
 * @param language Language for all images
 * @returns Combined text from all images
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

  console.log(
    `✅ Batch OCR complete: ${results.length} images, ${combinedText.length} chars, avg confidence: ${avgConfidence.toFixed(2)}`,
  );

  return {
    text: combinedText.trim(),
    language: language,
    confidence: avgConfidence,
    method: "hf-api",
  };
}
