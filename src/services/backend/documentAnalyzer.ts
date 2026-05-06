/**
 * Document Analyzer Service
 * Analyzes legal documents (PDF, DOC, DOCX) using Groq LLM
 * Returns structured legal analysis for Pakistani law context
 *
 * NEW FILE — does not modify any existing service
 *
 * Dependencies:
 *   - mammoth        (DOCX/DOC text extraction)  → npm install mammoth
 *   - pdfjs-dist     (already installed in project)
 *   - groq-sdk       (already installed in project)
 */

import Groq from "groq-sdk";
import { getAllGroqApiKeys } from "./utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseTimeline {
  date: string;
  event: string;
}

export interface DocumentAnalysisResult {
  caseSummary: string;
  simplifiedExplanation: string;
  caseDetails: {
    type: string;
    court: string;
    punishment: string;
    legalSection: string;
    confidenceScore: number;
    applicableLaws: string[];
    timeline: CaseTimeline[];
    estimatedYears: string;
  };
  comprehensiveAnalysis: {
    finalAnalysis: string;
    firNumber: string;
    whatHappened: string;
    steps: string[];
    whatItMatters: string;
    pakistaniCourts: string;
    evolution: string;
    note: string;
  };
  urduExplanation: string;
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdfjs-dist (already in project)
 */
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore — pdfjs-dist types
    const pdfjsLib = await import("pdfjs-dist");

    // Ensure DOMMatrix polyfill (already set up in server.ts at global scope)
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
      .promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as any[])
        .map((item: any) => item.str || "")
        .join(" ");
      pages.push(pageText);
    }

    const text = pages.join("\n\n").trim();
    console.log(
      `📄 PDF extraction: ${pdf.numPages} pages, ${text.length} chars`,
    );
    return text;
  } catch (err: any) {
    console.error("PDF extraction failed:", err.message);
    throw new Error(`Failed to read PDF: ${err.message}`);
  }
}

/**
 * Extract text from DOCX/DOC buffer using mammoth
 * Requires: npm install mammoth
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import so it doesn't crash if mammoth isn't installed yet
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    console.log(`📘 DOCX extraction: ${text.length} chars`);
    return text;
  } catch (err: any) {
    if (err.code === "MODULE_NOT_FOUND") {
      throw new Error(
        'DOCX support requires the "mammoth" package. Run: npm install mammoth',
      );
    }
    console.error("DOCX extraction failed:", err.message);
    throw new Error(`Failed to read DOCX/DOC file: ${err.message}`);
  }
}

/**
 * Extract plain text from a document buffer based on MIME type
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const lower = mimeType.toLowerCase();

  if (lower.includes("pdf")) {
    return extractPDFText(buffer);
  }

  if (
    lower.includes("wordprocessingml") ||
    lower.includes("msword") ||
    lower.includes("docx") ||
    lower.includes("doc")
  ) {
    return extractDocxText(buffer);
  }

  throw new Error(
    `Unsupported document type: ${mimeType}. Supported: PDF, DOC, DOCX`,
  );
}

// ─── LLM Analysis ─────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM_PROMPT = `You are an expert Pakistani legal analyst with deep knowledge of:
- Pakistan Penal Code (PPC 1860)
- Code of Criminal Procedure (CrPC 1898)
- Muslim Family Laws Ordinance 1961
- Protection of Women Act 2006
- Prevention of Electronic Crimes Act (PECA 2016)
- Constitution of Pakistan 1973
- Qanun-e-Shahadat Order 1984

You will analyze the provided legal document and return ONLY a valid JSON object (no markdown, no extra text).
The JSON must strictly follow the schema provided. Be thorough, accurate, and cite specific Pakistani laws.
If information is not present in the document, use "N/A" or an empty array — never hallucinate details.`;

const buildAnalysisPrompt = (
  documentText: string,
  lang: string,
): string => `Analyze this Pakistani legal document and return a JSON object with exactly this structure:

{
  "caseSummary": "<2-3 sentence summary of the document>",
  "simplifiedExplanation": "<plain language explanation for non-lawyers, 3-4 sentences>",
  "caseDetails": {
    "type": "<FIR | Contract | Court Order | Legal Brief | Writ Petition | Application | Judgment | Other>",
    "court": "<name of court if mentioned, else N/A>",
    "punishment": "<punishment or penalty mentioned, else N/A>",
    "legalSection": "<primary legal section(s) cited, e.g. PPC Section 302>",
    "confidenceScore": <integer 0-100 representing analysis confidence>,
    "applicableLaws": ["<law 1>", "<law 2>"],
    "timeline": [
      { "date": "<date or period>", "event": "<event description>" }
    ],
    "estimatedYears": "<estimated case duration, e.g. 2-4 years>"
  },
  "comprehensiveAnalysis": {
    "finalAnalysis": "<comprehensive 4-6 sentence legal analysis>",
    "firNumber": "<FIR number if present in document, else empty string>",
    "whatHappened": "<factual summary of events described in the document>",
    "steps": ["<step 1 the affected party should take>", "<step 2>", "<step 3>", "<step 4>"],
    "whatItMatters": "<why this legal matter is significant under Pakistani law>",
    "pakistaniCourts": "<how Pakistani courts typically handle this type of case>",
    "evolution": "<how this area of Pakistani law has evolved or recent developments>",
    "note": "QaanoonSathi provides general legal information only. Consult a licensed Pakistani attorney (Vakeel) for specific legal advice."
  },
  "urduExplanation": "<explanation of the document in Urdu language, 3-4 sentences>"
}

DOCUMENT TEXT:
${documentText.slice(0, 8000)}

${lang === "ur" ? "Note: Provide caseSummary and simplifiedExplanation also in Urdu." : ""}

Return ONLY the JSON object. No markdown, no code blocks, no additional text.`;

/**
 * Analyze document text using Groq LLM with multi-key fallback
 */
async function analyzeWithGroq(
  documentText: string,
  lang: string,
): Promise<DocumentAnalysisResult> {
  const groqKeys = getAllGroqApiKeys();

  if (groqKeys.length === 0) {
    throw new Error(
      "No Groq API keys configured. Set GROQ_API_KEY in environment variables.",
    );
  }

  const prompt = buildAnalysisPrompt(documentText, lang);
  let lastError: Error | null = null;

  for (let i = 0; i < groqKeys.length; i++) {
    const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`;

    try {
      console.log(`🔄 Analyzing document with Groq (${keyLabel})...`);
      const groq = new Groq({ apiKey: groqKeys[i] });

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        model: "llama-3.3-70b-versatile",
        max_tokens: 2000,
        temperature: 0.3,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) throw new Error("Empty response from Groq");

      // Strip potential markdown fences
      const jsonStr = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(jsonStr) as DocumentAnalysisResult;

      // Validate required top-level keys
      if (
        !parsed.caseSummary ||
        !parsed.caseDetails ||
        !parsed.comprehensiveAnalysis
      ) {
        throw new Error("Groq returned incomplete JSON structure");
      }

      // Ensure defaults for missing optional fields
      parsed.caseDetails.applicableLaws =
        parsed.caseDetails.applicableLaws || [];
      parsed.caseDetails.timeline = parsed.caseDetails.timeline || [];
      parsed.caseDetails.confidenceScore = Math.min(
        100,
        Math.max(0, parsed.caseDetails.confidenceScore || 70),
      );
      parsed.comprehensiveAnalysis.steps =
        parsed.comprehensiveAnalysis.steps || [];
      parsed.comprehensiveAnalysis.firNumber =
        parsed.comprehensiveAnalysis.firNumber || "";
      parsed.urduExplanation = parsed.urduExplanation || "";

      console.log(`✅ Document analysis complete (${keyLabel})`);
      return parsed;
    } catch (err: any) {
      lastError = err;
      const msg = err.message?.slice(0, 100) ?? String(err);
      console.warn(`⚠️ Groq (${keyLabel}) failed: ${msg}`);
      if (i < groqKeys.length - 1) {
        console.log("   Trying next Groq key...");
      }
    }
  }

  throw (
    lastError ?? new Error("Document analysis failed across all Groq API keys")
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Analyze a legal document buffer and return structured analysis
 *
 * @param buffer    Raw file buffer (PDF, DOC, DOCX)
 * @param mimeType  MIME type of the file
 * @param lang      'en' or 'ur' — language preference for the response
 */
export async function analyzeDocument(
  buffer: Buffer,
  mimeType: string,
  lang: string = "en",
): Promise<DocumentAnalysisResult> {
  console.log(
    `📂 Document analysis started: mimeType=${mimeType}, size=${buffer.length} bytes, lang=${lang}`,
  );

  // Step 1: Extract text
  const documentText = await extractDocumentText(buffer, mimeType);

  if (!documentText || documentText.trim().length < 50) {
    throw new Error(
      "Could not extract sufficient text from the document. " +
        "The file may be password-protected, corrupted, or contain only images. " +
        "Please ensure the document contains readable text.",
    );
  }

  console.log(`✅ Text extracted: ${documentText.length} characters`);

  // Step 2: Analyze with LLM
  const result = await analyzeWithGroq(documentText, lang);

  return result;
}
