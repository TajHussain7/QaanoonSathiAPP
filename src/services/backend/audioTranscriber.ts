/**
 * Audio Transcription Service
 * Converts audio files to text using Google Gemini API
 * Supports: webm, ogg, mp3, wav, m4a, flac, aac
 * Languages: Urdu, English, auto-detect
 *
 * Switched from HuggingFace (fal-ai Blob incompatibility) to Gemini Flash
 * which accepts base64-encoded audio inline and already has working API keys.
 */

import { getAllGeminiApiKeys } from "./utils.js";

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence?: number;
}

const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";
const TRANSCRIPTION_MODEL = "gemini-1.5-flash";

/**
 * Map common audio MIME types to Gemini-supported formats.
 * Gemini supports: audio/wav, audio/mp3, audio/aiff, audio/aac,
 *                  audio/ogg, audio/flac, audio/webm
 */
function normalizeAudioMimeType(mimeType?: string): string {
  if (!mimeType) return "audio/webm";
  const lower = mimeType.toLowerCase().split(";")[0].trim();
  const supported = [
    "audio/wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/aiff",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
    "audio/webm",
  ];
  if (supported.includes(lower)) return lower;
  if (lower.includes("webm")) return "audio/webm";
  if (lower.includes("ogg")) return "audio/ogg";
  if (lower.includes("mp3") || lower.includes("mpeg")) return "audio/mp3";
  if (lower.includes("wav")) return "audio/wav";
  return "audio/webm"; // safest default (what browsers record)
}

/**
 * Build a language-aware transcription prompt
 */
function buildTranscriptionPrompt(language?: string | null): string {
  if (language === "ur") {
    return (
      "This audio is in Urdu. Transcribe it exactly into Urdu script. " +
      "Output only the transcribed text with no extra commentary."
    );
  }
  if (language === "en") {
    return (
      "Transcribe this English audio recording exactly. " +
      "Output only the transcribed text with no extra commentary."
    );
  }
  return (
    "Transcribe this audio recording exactly. " +
    "The speaker may use English or Urdu. " +
    "Output only the transcribed text with no extra commentary."
  );
}

/**
 * Transcribe audio using Google Gemini 1.5 Flash.
 * Accepts a Buffer or Uint8Array and optional MIME type.
 */
export async function transcribeAudio(
  audioBuffer: Buffer | Uint8Array,
  language?: string | null,
  mimeType?: string,
): Promise<TranscriptionResult> {
  const allKeys = getAllGeminiApiKeys();
  if (allKeys.length === 0) {
    throw new Error(
      "No Gemini API keys found — set GEMINI_API_KEY in environment variables",
    );
  }

  const resolvedMime = normalizeAudioMimeType(mimeType);
  const base64Audio = Buffer.isBuffer(audioBuffer)
    ? audioBuffer.toString("base64")
    : Buffer.from(audioBuffer).toString("base64");

  const prompt = buildTranscriptionPrompt(language);

  console.log(
    `🎤 Transcribing audio via Gemini (${resolvedMime}, ${audioBuffer.length} bytes, lang: ${language || "auto"})...`,
  );

  let lastError: Error | null = null;

  for (let i = 0; i < allKeys.length; i++) {
    const apiKey = allKeys[i];
    const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`;

    try {
      const url = `${GEMINI_API_ENDPOINT}/${TRANSCRIPTION_MODEL}:generateContent?key=${apiKey}`;

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
                    mimeType: resolvedMime,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
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
          "No speech detected in audio. Please speak clearly and try again.",
        );
      }

      console.log(
        `✅ Transcription complete (${keyLabel}): ${text.length} chars`,
      );

      // Detect language from script if not provided
      const detectedLang =
        language || (/[\u0600-\u06FF]/.test(text) ? "ur" : "en");

      return {
        text,
        language: detectedLang,
        confidence: 0.92,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(
        `⚠️ Gemini transcription (${keyLabel}) failed: ${err.message?.slice(0, 80)}`,
      );
      if (i < allKeys.length - 1) {
        console.log("   Trying next API key...");
      }
    }
  }

  throw (
    lastError || new Error("Audio transcription failed for all Gemini API keys")
  );
}

/**
 * Batch transcribe multiple audio chunks.
 */
export async function transcribeAudioChunks(
  audioChunks: (Buffer | Uint8Array)[],
  language?: string,
): Promise<TranscriptionResult> {
  console.log(`🎤 Transcribing ${audioChunks.length} audio chunks...`);

  const results = await Promise.all(
    audioChunks.map((chunk) => transcribeAudio(chunk, language)),
  );

  const combinedText = results.map((r) => r.text).join(" ");
  const detectedLanguage = results[0]?.language || language || "unknown";

  return {
    text: combinedText.trim(),
    language: detectedLanguage,
    confidence: 0.92,
  };
}

/**
 * Detect language of audio by transcribing a small sample.
 */
export async function detectAudioLanguage(
  audioBuffer: Buffer | Uint8Array,
): Promise<string> {
  try {
    const result = await transcribeAudio(audioBuffer);
    return result.language;
  } catch {
    return "unknown";
  }
}

/**
 * Transcribe audio with explicit language handling.
 */
export async function transcribeAudioByLanguage(
  audioBuffer: Buffer | Uint8Array,
  language: "ur" | "en" | "auto" = "auto",
): Promise<TranscriptionResult> {
  const lang = language === "auto" ? undefined : language;
  return transcribeAudio(audioBuffer, lang);
}
