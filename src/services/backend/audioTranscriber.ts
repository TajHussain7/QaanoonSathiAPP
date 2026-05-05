/**
 * Audio Transcription Service
 * Uses Groq Whisper (whisper-large-v3) — same GROQ_API_KEY already used by llmService.ts
 *
 * Why Groq Whisper instead of Gemini:
 *   - GROQ_API_KEY is already configured and working on Render
 *   - Whisper-large-v3 supports Urdu (language code "ur") natively
 *   - Free tier: 7200 audio seconds/hour — more than enough
 *   - No new API keys or environment variables needed
 *
 * Supports: webm, ogg, mp3, wav, m4a, flac, aac (browser default is webm)
 */

import Groq from "groq-sdk";
import { getAllGroqApiKeys } from "./utils.js";

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence?: number;
}

const WHISPER_MODEL = "whisper-large-v3";

/**
 * Map language codes to Whisper-supported ISO 639-1 codes.
 * Whisper supports Urdu ("ur") natively.
 */
function resolveWhisperLanguage(language?: string | null): string | undefined {
  if (!language || language === "auto") return undefined; // let Whisper detect
  if (language === "ur") return "ur";
  if (language === "en") return "en";
  return undefined;
}

/**
 * Normalize audio MIME type for filename extension mapping.
 */
function mimeToExtension(mimeType?: string): string {
  if (!mimeType) return "webm";
  const lower = mimeType.toLowerCase().split(";")[0].trim();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mp3") || lower.includes("mpeg")) return "mp3";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("flac")) return "flac";
  if (lower.includes("aac")) return "aac";
  if (lower.includes("m4a") || lower.includes("mp4")) return "m4a";
  return "webm"; // browser MediaRecorder default
}

/**
 * Transcribe audio using Groq Whisper.
 * Tries each GROQ_API_KEY with automatic fallback.
 *
 * @param audioBuffer  Raw audio data (Buffer or Uint8Array)
 * @param language     'ur', 'en', null/'auto' for Whisper auto-detect
 * @param mimeType     Optional MIME type hint (e.g. 'audio/webm')
 */
export async function transcribeAudio(
  audioBuffer: Buffer | Uint8Array,
  language?: string | null,
  mimeType?: string,
): Promise<TranscriptionResult> {
  const allKeys = getAllGroqApiKeys();

  if (allKeys.length === 0) {
    throw new Error(
      "No Groq API keys found — set GROQ_API_KEY in Render environment variables. " +
        "This is the same key used for your AI Q&A feature.",
    );
  }

  const ext = mimeToExtension(mimeType);
  const filename = `recording.${ext}`;
  const whisperLang = resolveWhisperLanguage(language);

  // Convert to Buffer if needed
  const buf = Buffer.isBuffer(audioBuffer)
    ? audioBuffer
    : Buffer.from(audioBuffer as Uint8Array);

  console.log(
    `🎤 Groq Whisper (${WHISPER_MODEL}, ${filename}, ${buf.length} bytes, lang: ${whisperLang ?? "auto"})...`,
  );

  let lastError: Error | null = null;

  for (let i = 0; i < allKeys.length; i++) {
    const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`;

    try {
      const groq = new Groq({ apiKey: allKeys[i] });

      // Node.js 18+ has File built-in; Render uses Node 18+
      const audioFile = new File([buf], filename, {
        type: mimeType ?? "audio/webm",
      });

      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: WHISPER_MODEL,
        ...(whisperLang ? { language: whisperLang } : {}),
        response_format: "json",
      });

      const text = transcription.text?.trim() ?? "";

      if (!text || text.length === 0) {
        throw new Error(
          "No speech detected in audio. Please speak clearly and try again.",
        );
      }

      // Detect script to confirm language
      const detectedLang =
        language && language !== "auto"
          ? language
          : /[\u0600-\u06FF]/.test(text)
            ? "ur"
            : "en";

      console.log(
        `✅ Whisper transcription complete (${keyLabel}): ${text.length} chars, lang: ${detectedLang}`,
      );

      return {
        text,
        language: detectedLang,
        confidence: 0.93,
      };
    } catch (err: any) {
      lastError = err;
      const msg = err.message?.slice(0, 120) ?? String(err);
      console.warn(`⚠️ Groq Whisper (${keyLabel}) failed: ${msg}`);
      if (i < allKeys.length - 1) console.log("   Trying next Groq key...");
    }
  }

  throw (
    lastError ??
    new Error(
      "Audio transcription failed across all Groq API keys. " +
        "Check GROQ_API_KEY on Render.",
    )
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

  return {
    text: results
      .map((r) => r.text)
      .join(" ")
      .trim(),
    language: results[0]?.language ?? language ?? "unknown",
    confidence: 0.93,
  };
}

/**
 * Detect language from audio by letting Whisper auto-detect.
 */
export async function detectAudioLanguage(
  audioBuffer: Buffer | Uint8Array,
): Promise<string> {
  try {
    const result = await transcribeAudio(audioBuffer, null);
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
  const lang = language === "auto" ? null : language;
  return transcribeAudio(audioBuffer, lang);
}
