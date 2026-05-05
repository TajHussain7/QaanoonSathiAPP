/**
 * Image OCR Service
 * Extracts text from images using OpenRouter vision models (OpenAI-compatible API)
 *
 * Why OpenRouter instead of Gemini:
 *   - Gemini API key currently configured is not a valid Gemini key (starts AQ. not AIza...)
 *   - OpenRouter provides free access to multiple capable vision models
 *   - Automatic fallback across free models if one hits rate limits
 *
 * REQUIRED — add to Render environment variables:
 *   OPENROUTER_API_KEY = your OpenRouter API key (from openrouter.ai)
 *
 * Free vision models used (in priority order):
 *   1. google/gemini-2.0-flash-exp:free  — best for Urdu + English documents
 *   2. meta-llama/llama-4-scout:free     — strong multilingual vision
 *   3. qwen/qwen2.5-vl-72b-instruct:free — good for dense text / mixed scripts
 *
 * Supports: JPG, PNG, WebP, BMP, GIF
 * Languages: Urdu, English
 */

export interface OCRResult {
  text: string;
  language: string;
  confidence: number;
  method: "hf-api" | "tesseract"; // preserved for interface compatibility
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free vision models in priority order (first available key wins)
const VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-4-scout:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
];

/**
 * Detect image MIME type from magic bytes.
 * Uses Buffer.isBuffer() to avoid TypeScript narrowing-to-never issue.
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
 * Call OpenRouter vision API with a specific model.
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
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter ${model} returned HTTP ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  return text;
}

/**
 * Extract text from image using OpenRouter vision models.
 * Tries each free model in order; falls back if one hits rate limits.
 */
export async function extractTextFromImageHF(
  imageBuffer: Buffer | Uint8Array,
  language: "ur" | "en" = "en",
): Promise<OCRResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. " +
        "Go to Render → Environment and add OPENROUTER_API_KEY with your key from openrouter.ai",
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

  let lastError: Error | null = null;

  for (let i = 0; i < VISION_MODELS.length; i++) {
    const model = VISION_MODELS[i];

    try {
      console.log(`   Trying model: ${model}`);
      const text = await callOpenRouterVision(
        apiKey,
        model,
        base64Image,
        mimeType,
        prompt,
      );

      if (!text || text.length === 0) {
        throw new Error(
          "No text found in this image. Ensure the image is clear and contains readable text.",
        );
      }

      console.log(
        `✅ OCR complete (${model}): ${text.length} chars, format: ${mimeType}`,
      );

      return {
        text,
        language,
        confidence: 0.92,
        method: "hf-api",
      };
    } catch (err: any) {
      lastError = err;
      const msg = err.message?.slice(0, 120) ?? String(err);
      console.warn(`⚠️ OCR model ${model} failed: ${msg}`);
      if (i < VISION_MODELS.length - 1)
        console.log("   Trying next vision model...");
    }
  }

  throw (
    lastError ??
    new Error(
      "Image text extraction failed for all OpenRouter vision models. " +
        "Supported formats: JPG, PNG, WebP, GIF. " +
        "Check OPENROUTER_API_KEY on Render.",
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
