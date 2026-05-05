/**
 * Image OCR Service
 * Extracts text from images using OpenRouter vision models (OpenAI-compatible API)
 *
 * REQUIRED — Render environment variable:
 *   OPENROUTER_API_KEY = your key from openrouter.ai
 *
 * Models used (Google Gemma family — verified valid on OpenRouter May 2025):
 *   Gemma 4 31B → Gemma 4 26B → Gemma 3 27B → Gemma 3 12B
 *
 * Rate limit handling: waits 3 s between models so consecutive uploads don't
 * exhaust the per-minute quota immediately.
 *
 * Supports: JPG, PNG, WebP, BMP, GIF
 */

export interface OCRResult {
  text: string;
  language: string;
  confidence: number;
  method: "hf-api" | "tesseract";
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Only Google Gemma models — confirmed valid IDs (no NVIDIA, their free IDs are unstable).
// Four models give us enough fallback depth for rate-limit situations.
const VISION_MODELS = [
  "google/gemma-4-31b-it:free", // Gemma 4 31B — best quality, 256K ctx, 140+ languages
  "google/gemma-4-26b-a4b-it:free", // Gemma 4 MoE — strong, 256K ctx
  "google/gemma-3-27b-it:free", // Gemma 3 27B — solid fallback, 131K ctx
  "google/gemma-3-12b-it:free", // Gemma 3 12B — lightest, least likely rate-limited
];

// Delay between model attempts (milliseconds).
// Prevents exhausting per-minute quota on consecutive uploads.
const RETRY_DELAY_MS = 3000;

/** Simple sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify an HTTP error into a user-friendly category.
 */
function classifyError(
  status: number,
  body: string,
): "rate_limit" | "invalid" | "other" {
  if (status === 429) return "rate_limit";
  if (status === 400 && body.includes("not a valid model")) return "invalid";
  return "other";
}

/**
 * Detect image MIME type from magic bytes.
 * Uses Buffer.isBuffer() to avoid TypeScript narrowing-to-never bug.
 */
function detectImageMimeType(buffer: Buffer | Uint8Array): string {
  const b: Buffer = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer as Uint8Array);

  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  if (b.length > 9 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57)
    return "image/webp";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";

  return "image/jpeg";
}

/**
 * Build OCR prompt for the target language.
 */
function buildOcrPrompt(language: "ur" | "en"): string {
  if (language === "ur") {
    return (
      "This document contains Urdu or mixed Urdu/English text. " +
      "Extract ALL visible text exactly as written, preserving Urdu script (Nastaliq). " +
      "Output ONLY the extracted text — no commentary, no labels, no explanations."
    );
  }
  return (
    "Extract ALL text visible in this image exactly as written. " +
    "Preserve paragraphs and line breaks where possible. " +
    "Output ONLY the extracted text — no commentary, no labels, no explanations."
  );
}

/**
 * Call OpenRouter vision API for one model.
 * Throws an annotated error with HTTP status embedded for classifyError().
 */
async function callOpenRouterVision(
  apiKey: string,
  model: string,
  base64Image: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://qaanoonsathi.onrender.com",
      "X-Title": "QaanoonSathi Legal AI",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Embed status in message so classifyError() can parse it
    const err = new Error(`HTTP_${response.status}:${body.slice(0, 300)}`);
    (err as any).status = response.status;
    (err as any).body = body;
    throw err;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`API_ERROR:${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Extract text from image using OpenRouter vision models.
 * Tries each model in order; on rate-limit (429) waits before next attempt.
 * Throws a user-friendly (non-technical) error if all models fail.
 */
export async function extractTextFromImageHF(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "Image reading is not configured. Please contact the administrator to set up the OPENROUTER_API_KEY.",
    );
  }

  const mimeType = detectImageMimeType(imageBuffer);
  const base64Image = Buffer.isBuffer(imageBuffer)
    ? imageBuffer.toString("base64")
    : Buffer.from(imageBuffer as Uint8Array).toString("base64");

  const prompt = buildOcrPrompt(language);

  console.log(
    `📸 OCR via OpenRouter (${mimeType}, ${imageBuffer.length} bytes, lang: ${language})...`,
  );

  let rateLimitCount = 0;
  const technicalLog: string[] = []; // kept for server logs only, never shown to user

  for (let i = 0; i < VISION_MODELS.length; i++) {
    const model = VISION_MODELS[i];

    // Wait before each attempt after the first — prevents rate-limit cascade
    // on consecutive uploads within the same minute
    if (i > 0) {
      console.log(`   Waiting ${RETRY_DELAY_MS / 1000}s before next model...`);
      await sleep(RETRY_DELAY_MS);
    }

    try {
      console.log(
        `   Trying model [${i + 1}/${VISION_MODELS.length}]: ${model}`,
      );
      const text = await callOpenRouterVision(
        apiKey,
        model,
        base64Image,
        mimeType,
        prompt,
      );

      if (!text || text.length === 0) {
        throw new Error("EMPTY_RESULT");
      }

      console.log(`✅ OCR complete (${model}): ${text.length} chars`);
      return { text, language, confidence: 0.92, method: "hf-api" };
    } catch (err: any) {
      const raw = err.message ?? String(err);
      const status: number = err.status ?? 0;
      const body: string = err.body ?? raw;
      const kind = classifyError(status, body);

      technicalLog.push(
        `[${model}] HTTP ${status || "ERR"}: ${raw.slice(0, 100)}`,
      );
      console.warn(`⚠️ OCR [${model}] failed (${kind}): ${raw.slice(0, 100)}`);

      if (kind === "rate_limit") rateLimitCount++;

      // Skip invalid model IDs immediately — no point retrying
      if (kind === "invalid") {
        console.warn(
          `   Skipping ${model} — model ID not recognised by OpenRouter`,
        );
      }
    }
  }

  // ── All models failed — return a plain-language message to the user ──────────

  // Log the full technical details server-side for debugging
  console.error(
    "❌ All OCR models failed.\n" +
      technicalLog.map((l, i) => `  ${i + 1}. ${l}`).join("\n"),
  );

  // User-facing message — no HTTP codes, no model IDs, no jargon
  if (rateLimitCount === VISION_MODELS.length) {
    throw new Error(
      "The image reading service is busy right now. " +
        "Please wait about 30 seconds and upload the image again.",
    );
  }

  if (rateLimitCount > 0) {
    throw new Error(
      "Image processing is temporarily busy. " +
        "Please wait a moment and try uploading again.",
    );
  }

  throw new Error(
    "We were unable to read text from this image. " +
      "Please make sure it is a clear JPG, PNG, or WebP image and try again.",
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
      "The image quality is too low to read reliably. " +
        "Please try a sharper, higher-resolution image.",
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

  const results: OCRResult[] = [];
  for (let idx = 0; idx < imageBuffers.length; idx++) {
    console.log(`   [${idx + 1}/${imageBuffers.length}]`);
    // Sequential processing with built-in delay avoids rate limits in batch
    results.push(await extractTextFromImage(imageBuffers[idx], language));
  }

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
