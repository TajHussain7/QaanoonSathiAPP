import { Groq } from "groq-sdk";
import { getGenAIClient, getAllGroqApiKeys } from "./utils.js";

/**
 * Normalizes Roman Urdu and cleans the query for optimal RAG embedding
 */
export async function cleanAndNormalizeQuery(query: string): Promise<string> {
  const groqKeys = getAllGroqApiKeys();

  for (const groqKey of groqKeys) {
    try {
      const groq = new Groq({ apiKey: groqKey });
      const response = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Normalize this legal query for a Pakistani law database. 
            If it is in Roman Urdu, convert it to clear English/Urdu legal terms.
            Remove conversational filler. Maintain the legal core.
            Input: "${query}"
            Output normalized query:`,
          },
        ],
        model: "llama-3.3-70b-versatile",
        max_tokens: 200,
      });

      return response.choices[0]?.message?.content?.trim() || query;
    } catch (error) {
      console.warn("Groq cleaning failed, trying next key...", error);
    }
  }

  console.warn("Query cleaning failed, using raw query");
  return query;
}

/**
 * Extracts text from an image or PDF for legal query processing
 */
export async function extractTextFromMedia(
  fileData: string,
  mimeType: string,
): Promise<string> {
  const ai = getGenAIClient();
  if (!ai) throw new Error("AI client not available");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro-vision-latest",
      contents: [
        {
          inlineData: {
            data: fileData,
            mimeType: mimeType,
          },
        },
        "This is a legal document or a photo of a legal query. Extract the core legal question or relevant facts from this. If it's a document, summarize the main legal issue.",
      ],
    });

    return response.text.trim();
  } catch (error) {
    console.error("Media extraction failed:", error);
    throw new Error("Could not process the uploaded file.");
  }
}

/**
 * Simulates ASR/Whisper using Gemini (Gemini 1.5 Flash handles audio/video too)
 */
export async function processAudioInput(audioData: string): Promise<string> {
  // In a real scenario, we'd send the audio byte stream to Gemini
  // For this environment, we'll assume the frontend captures audio and sends base64
  return extractTextFromMedia(audioData, "audio/mp3");
}
