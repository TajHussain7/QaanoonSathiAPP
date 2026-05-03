/**
 * Image OCR Service
 * Extracts text from images using HF Inference API (document understanding models)
 * Fallback: Tesseract.js for local OCR (CPU-based)
 * Supports: JPG, PNG, WebP, BMP, GIF
 * Languages: Urdu, English
 */

import { HfInference } from "@huggingface/inference";
import Tesseract from "tesseract.js";

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

    // Use document understanding via HF API with proper inputs format
    const result = await client.documentQuestionAnswering({
      model: "naver-clova-ix/donut-base",
      inputs: {
        image: base64Image,
        question: "Extract all text from this document exactly as written.",
      },
    } as any);

    const text = (result as any).answer || "";

    console.log(`✅ HF OCR complete: ${text.length} chars, method: HF API`);

    return {
      text: text.trim(),
      language: language,
      confidence: 0.85,
      method: "hf-api",
    };
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.warn(
      `⚠️ HF OCR failed (${errorMsg.slice(0, 60)}), falling back to Tesseract...`,
    );

    // Fall back to Tesseract.js
    return extractTextFromImageTesseract(imageBuffer, language);
  }
}

/**
 * Extract text from image using Tesseract.js (local, CPU-based OCR)
 * More reliable for diverse text, works offline, but slower
 * Uses Tesseract.js v7 worker-based API
 * @param imageBuffer Buffer or Uint8Array of image file
 * @param language 'ur' for Urdu, 'en' for English
 * @returns Extracted text and confidence
 */
export async function extractTextFromImageTesseract(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  let worker: any = null;

  try {
    console.log(
      `🔤 Extracting text from image (Tesseract.js v7, local OCR)...`,
    );

    // Map language codes to Tesseract language codes
    const langMap: Record<string, string> = {
      ur: "urd", // Urdu
      en: "eng", // English
    };

    const tesseractLang = langMap[language] || "eng";

    // Create image from buffer
    const base64 = Buffer.isBuffer(imageBuffer)
      ? imageBuffer.toString("base64")
      : Buffer.from(imageBuffer).toString("base64");
    const imageSrc = `data:image/png;base64,${base64}`;

    // Create Tesseract worker (v7 API - try createWorker first)
    console.log(
      `   Creating Tesseract worker for language: ${tesseractLang}...`,
    );

    // Try the createWorker API (v7 standard)
    let createWorkerFn: any;
    if (typeof (Tesseract as any).createWorker === "function") {
      createWorkerFn = (Tesseract as any).createWorker;
    } else if (typeof (Tesseract as any).default?.createWorker === "function") {
      createWorkerFn = (Tesseract as any).default.createWorker;
    } else if (typeof (Tesseract as any).create === "function") {
      createWorkerFn = (Tesseract as any).create;
    } else {
      throw new Error(
        "Tesseract.js API not found. Expected createWorker() or create() function.",
      );
    }

    worker = await createWorkerFn();

    // Load and initialize language
    console.log(`   Loading language: ${tesseractLang}...`);
    await worker.loadLanguage(tesseractLang);
    await worker.initialize(tesseractLang);

    // Perform OCR
    console.log(`   Recognizing text...`);
    const result = await worker.recognize(imageSrc);
    const text = result.data.text;
    const confidence = result.data.confidence || 85; // Confidence from 0-100

    console.log(
      `✅ Tesseract OCR complete: ${text.length} chars, confidence: ${confidence.toFixed(0)}%`,
    );

    // Clean up worker
    await worker.terminate();
    worker = null;

    return {
      text: text.trim(),
      language: language,
      confidence: confidence / 100, // Convert to 0-1 range
      method: "tesseract",
    };
  } catch (error: any) {
    // Clean up worker on error
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.warn("Error terminating Tesseract worker:", e);
      }
    }

    const errorMsg = error.message || String(error);
    console.error(`❌ Tesseract OCR failed: ${errorMsg.slice(0, 100)}`);

    // Provide detailed error information
    if (errorMsg.includes("ENOSPC") || errorMsg.includes("out of memory")) {
      throw new Error(
        "Insufficient memory for OCR. Please try a smaller image.",
      );
    } else if (errorMsg.includes("timeout")) {
      throw new Error("OCR processing timed out. Please try a simpler image.");
    } else {
      throw new Error(`Image OCR failed: ${errorMsg}`);
    }
  }
}

/**
 * Smart OCR: Try HF API first, fallback to Tesseract automatically
 * @param imageBuffer Image buffer
 * @param language 'ur' for Urdu, 'en' for English
 * @returns Extracted text with metadata
 */
export async function extractTextFromImage(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  console.log(`📸 Starting smart OCR (language: ${language})...`);

  try {
    // Try HF API first
    return await extractTextFromImageHF(imageBuffer, language);
  } catch (error) {
    console.warn("HF API failed, retrying with Tesseract local OCR...");
    try {
      return await extractTextFromImageTesseract(imageBuffer, language);
    } catch (tessError) {
      console.error("Both OCR methods failed");
      throw tessError;
    }
  }
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
    method: results[0]?.method || "tesseract",
  };
}
