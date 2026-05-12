import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// ===== CRITICAL FIX: DOMMatrix Polyfill for Node.js =====
// pdf.js and other libraries require DOMMatrix which is a browser API
// This polyfill prevents "DOMMatrix is not defined" errors
if (typeof globalThis.DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    public a: number;
    public b: number;
    public c: number;
    public d: number;
    public e: number;
    public f: number;

    constructor(
      a: number = 1,
      b: number = 0,
      c: number = 0,
      d: number = 1,
      e: number = 0,
      f: number = 0,
    ) {
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;
    }

    get m11(): number {
      return this.a;
    }
    get m12(): number {
      return this.b;
    }
    get m21(): number {
      return this.c;
    }
    get m22(): number {
      return this.d;
    }
    get m41(): number {
      return this.e;
    }
    get m42(): number {
      return this.f;
    }
  };
}
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to resolve module paths for dynamic imports
const resolveModule = (modulePath: string): string => {
  const absolutePath = path.resolve(__dirname, modulePath);
  // Return file:// URL for reliable module loading
  return new URL(`file://${absolutePath.replace(/\\/g, "/")}`).href;
};

// ── In-memory trending counter (resets on restart, no DB required) ──────────
const trendingCounter: Record<
  string,
  { count: number; category: string; lang: string; query: string }
> = {};

// ── Groq direct helper (used by /api/followup and /api/checklist) ────────────
const callGroqDirect = async (
  messages: Array<{ role: string; content: string }>,
  maxTokens = 400,
): Promise<string> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });
    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
};

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Log environment status
  console.log("🛠️ Environment Status Check:");
  const logKey = (name: string) => {
    const val = process.env[name];
    if (!val) {
      console.log(`- ${name}: ❌ MISSING`);
    } else if (
      val === "YOUR_SECOND_GEMINI_KEY_HERE" ||
      val === "YOUR_THIRD_GEMINI_KEY_HERE" ||
      val === "YOUR_GEMINI_API_KEY" ||
      val.includes("REPLACE")
    ) {
      console.log(`- ${name}: ⚠️ PLACEHOLDER DETECTED`);
    } else {
      console.log(
        `- ${name}: ✅ SET (length: ${val.length}, prefix: ${val.substring(0, 6)}...)`,
      );
    }
  };

  logKey("GEMINI_API_KEY");
  logKey("GEMINI_API_KEY_2");
  logKey("GEMINI_API_KEY_3");
  logKey("SUPABASE_URL");
  logKey("SUPABASE_ANON_KEY");

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Configure multer for file uploads (media processing)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB limit for media files
    },
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      env: {
        supabase: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
      },
    });
  });

  // Authentication Endpoints
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, full_name, preferred_lang } = req.body;
    try {
      const { supabase } = await import(
        resolveModule("src/services/backend/supabaseClient.js")
      );
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name, preferred_lang },
        },
      });
      if (error) throw error;

      // Handle the case where email verification is enabled (session will be null)
      if (!data.session) {
        return res.json({
          user: data.user,
          message:
            "Registration successful! Please check your email to confirm your account before logging in.",
        });
      }

      res.json({ user: data.user, token: data.session?.access_token });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Replace your existing /api/auth/login route with this:
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    // Guard: reject obviously invalid bodies (startup/test calls)
    if (
      !email ||
      !password ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!email.includes("@") || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Invalid email or password format" });
    }

    try {
      const { supabase } = await import(
        resolveModule("src/services/backend/supabaseClient.js")
      );
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data.session)
        throw new Error("Session not created. Please verify your email first.");
      res.json({ user: data.user, token: data.session.access_token });
    } catch (error: any) {
      console.error("Login error:", error.message); // Less noisy log
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { supabase } = await import(
        resolveModule("src/services/backend/supabaseClient.js")
      );
      const { data, error } = await supabase.auth.getUser(token);
      if (error) throw error;
      res.json({ user: data.user });
    } catch (error: any) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/auth/history", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { supabase } = await import(
        resolveModule("src/services/backend/supabaseClient.js")
      );
      const { data: userData, error: userError } =
        await supabase.auth.getUser(token);
      if (userError) throw userError;

      const { data, error } = await supabase
        .from("search_history")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      res.json({ history: data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vector Search Endpoint (Back-only search)
  app.post("/api/search", async (req, res) => {
    const { embedding, category } = req.body;
    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({ error: "Context embedding is required" });
    }

    try {
      const { searchSimilarChunks } = await import(
        resolveModule("src/services/backend/supabaseClient.js")
      );
      const results = await searchSimilarChunks(embedding, 3, category);
      res.json({ results });
    } catch (error: any) {
      console.error("Vector search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // NEW: Query Cleaning Endpoint
  app.post("/api/preprocess/clean", async (req, res) => {
    const { query } = req.body;
    try {
      const { cleanAndNormalizeQuery } = await import(
        resolveModule("src/services/backend/inputProcessor.js")
      );
      const cleaned = await cleanAndNormalizeQuery(query);
      res.json({ cleaned });
    } catch (error) {
      res.status(500).json({ error: "Cleaning failed" });
    }
  });

  // NEW: Media Processing Endpoint
  app.post("/api/preprocess/media", async (req, res) => {
    const { fileData, mimeType } = req.body;
    try {
      const { extractTextFromMedia } = await import(
        resolveModule("src/services/backend/inputProcessor.js")
      );
      const extracted = await extractTextFromMedia(fileData, mimeType);
      res.json({ extracted });
    } catch (error) {
      res.status(500).json({ error: "Media processing failed" });
    }
  });

  // NEW: Audio Transcription Endpoint
  app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const language = req.body.language || "auto"; // 'ur', 'en', or 'auto'

      const { extractTextFromMedia } = await import(
        resolveModule("src/services/backend/mediaExtractor.js")
      );

      const result = await extractTextFromMedia(
        req.file.buffer,
        req.file.mimetype,
        language,
      );

      if (result.error) {
        return res.status(400).json({
          error: result.error,
          details: `Audio transcription failed`,
        });
      }

      console.log(
        `✅ Transcription endpoint: ${result.text.length} chars extracted`,
      );

      res.json({
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        source: "whisper",
      });
    } catch (error: any) {
      console.error("Transcription error:", error);
      res.status(500).json({
        error: error.message || "Audio transcription failed",
      });
    }
  });

  // NEW: Image/PDF Text Extraction Endpoint
  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file provided",
          message: "Please upload a file (PDF, Image, or Audio)",
        });
      }

      const language = req.body.language || "en"; // 'ur' or 'en'
      const supportedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];

      if (!supportedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: "Unsupported file type",
          message: `File type "${req.file.mimetype}" is not supported. Please use: PDF, JPG, PNG, WebP, or GIF`,
          supportedTypes,
        });
      }

      const { extractTextFromMedia, validateExtractionResult } = await import(
        resolveModule("src/services/backend/mediaExtractor.js")
      );

      const result = await extractTextFromMedia(
        req.file.buffer,
        req.file.mimetype,
        language,
      );

      // Validate extraction result
      const validation = validateExtractionResult(result);
      if (!validation.isValid) {
        return res.status(400).json({
          error: validation.message,
          mediaType: result.mediaType,
          message: "Failed to extract text from file. Please try another file.",
        });
      }

      if (!result.text || result.text.trim().length === 0) {
        return res.status(400).json({
          error: "No text found",
          message:
            "The file appears to be empty or could not be processed. Please check the file and try again.",
          mediaType: result.mediaType,
        });
      }

      console.log(
        `✅ Extract-text endpoint: ${result.text.length} chars extracted from ${result.mediaType}`,
      );

      res.json({
        text: result.text,
        mediaType: result.mediaType,
        language: result.language,
        confidence: result.confidence,
        method: result.method,
        metadata: result.metadata,
        message: validation.message || "Text extracted successfully",
      });
    } catch (error: any) {
      console.error("Text extraction error:", error);
      const errorMessage = error.message || "Failed to process file";
      console.error("Full error details:", error);

      res.status(500).json({
        error: errorMessage,
        message:
          "An error occurred while processing your file. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? error.stack
            : "Contact support if this persists",
      });
    }
  });

  // NEW: Combined Media Processing Endpoint (text + RAG)
  app.post("/api/process-media", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const language = req.body.language || "en";
      const category = req.body.category || "";

      const { extractTextFromMedia, normalizeExtractedText } = await import(
        resolveModule("src/services/backend/mediaExtractor.js")
      );
      const { performRagQuery } = await import(
        resolveModule("src/services/backend/ragEngine.js")
      );

      // Step 1: Extract text from media
      const extractionResult = await extractTextFromMedia(
        req.file.buffer,
        req.file.mimetype,
        language,
      );

      if (extractionResult.error) {
        return res.status(400).json({
          error: extractionResult.error,
          mediaType: extractionResult.mediaType,
        });
      }

      // Step 2: Normalize extracted text
      const normalizedText = normalizeExtractedText(
        extractionResult.text,
        extractionResult.mediaType,
      );

      // Step 3: Get user ID from token (optional)
      let userId: string | undefined;
      const token = req.headers.authorization?.split(" ")[1];
      if (token && token !== "null") {
        const { supabase } = await import(
          resolveModule("src/services/backend/supabaseClient.js")
        );
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user) {
          userId = userData.user.id;
        }
      }

      // Step 4: Perform RAG query on extracted text
      const ragResult = await performRagQuery(
        normalizedText,
        category,
        language,
        userId,
        extractionResult.mediaType, // Pass source type for source-aware processing
      );

      console.log(
        `✅ Process-media endpoint: Extracted ${extractionResult.text.length} chars, generated RAG answer`,
      );

      res.json({
        extracted: {
          text: extractionResult.text,
          mediaType: extractionResult.mediaType,
          confidence: extractionResult.confidence,
        },
        answer: ragResult.answer,
        sources: ragResult.sources,
        llmUsed: ragResult.llmUsed,
      });
    } catch (error: any) {
      console.error("Process-media error:", error);
      res.status(500).json({
        error: error.message || "Media processing and RAG query failed",
      });
    }
  });

  // RAG Query Route
  app.post("/api/query", async (req, res) => {
    const { query, category, lang, conversationHistory, jurisdiction } =
      req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      let userId: string | undefined;
      const token = req.headers.authorization?.split(" ")[1];

      if (token && token !== "null") {
        const { supabase } = await import(
          resolveModule("src/services/backend/supabaseClient.js")
        );
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user) {
          userId = userData.user.id;
        }
      }

      // Build context-aware query (multi-turn memory + jurisdiction)
      let fullQuery = query;

      if (
        Array.isArray(conversationHistory) &&
        conversationHistory.length > 0
      ) {
        const contextLines = conversationHistory
          .slice(-3)
          .map(
            (h: any) =>
              `Q: ${String(h.query).slice(0, 150)}\nA: ${String(h.answer).slice(0, 200)}`,
          )
          .join("\n\n");
        fullQuery = `Previous context:\n${contextLines}\n\nCurrent question: ${query}`;
      }

      if (jurisdiction && jurisdiction !== "all") {
        const provinceMap: Record<string, string> = {
          federal: "Federal (Islamabad)",
          punjab: "Punjab",
          sindh: "Sindh",
          kpk: "Khyber Pakhtunkhwa (KPK)",
          balochistan: "Balochistan",
        };
        fullQuery += ` (Jurisdiction: ${provinceMap[jurisdiction] || jurisdiction}, Pakistan)`;
      }

      // Update in-memory trending counter
      const trendingKey = String(query).trim().toLowerCase().slice(0, 120);
      if (trendingCounter[trendingKey]) {
        trendingCounter[trendingKey].count++;
      } else {
        trendingCounter[trendingKey] = {
          count: 1,
          category: category || "General",
          lang: lang || "en",
          query: String(query).trim(),
        };
      }

      const { performRagQuery } = await import(
        resolveModule("src/services/backend/ragEngine.js")
      );
      const result = await performRagQuery(fullQuery, category, lang, userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing query:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ── NEW: Generate follow-up questions ──────────────────────────────────────
  app.post("/api/followup", async (req, res) => {
    const { query, answer, lang } = req.body;
    if (!query || !answer) {
      return res.status(400).json({ error: "query and answer are required" });
    }

    try {
      const isUrdu = lang === "ur";
      const prompt = isUrdu
        ? `ایک قانونی سوال اور اس کا جواب دیا گیا ہے۔ اس سے متعلق بالکل 3 مختصر فالو-اپ سوالات لکھیں جو اگلے مرحلے میں مفید ہوں۔ صرف سوالات لکھیں، ایک لائن میں ہر سوال، کوئی numbering نہیں۔\n\nسوال: ${query}\nجواب: ${String(answer).slice(0, 400)}`
        : `Given this Pakistani legal Q&A, generate exactly 3 concise follow-up questions a user might ask next. Return only the questions, one per line, no numbering, no prefixes, no extra text.\n\nQuestion: ${query}\nAnswer: ${String(answer).slice(0, 400)}`;

      const content = await callGroqDirect(
        [
          {
            role: "system",
            content:
              "You are a Pakistani legal assistant. Generate concise, practical follow-up questions.",
          },
          { role: "user", content: prompt },
        ],
        250,
      );

      const questions = content
        .split("\n")
        .map((q: string) => q.replace(/^[-•*\d.]+\s*/, "").trim())
        .filter((q: string) => q.length > 8 && q.length < 220)
        .slice(0, 3);

      res.json({ questions });
    } catch (error: any) {
      console.error("Followup generation error:", error.message);
      res.status(500).json({ error: "Failed to generate follow-up questions" });
    }
  });

  // ── NEW: Store answer feedback ─────────────────────────────────────────────
  app.post("/api/feedback", async (req, res) => {
    const { query, answer, rating, lang } = req.body;
    if (!query || typeof rating !== "number") {
      return res
        .status(400)
        .json({ error: "query and numeric rating are required" });
    }

    try {
      const { supabase } = await import(
        resolveModule("src/services/backend/supabaseClient.js")
      );

      // Optional user ID
      let userId: string | null = null;
      const token = req.headers.authorization?.split(" ")[1];
      if (token && token !== "null") {
        const { data: userData } = await supabase.auth.getUser(token);
        userId = userData?.user?.id || null;
      }

      const { error } = await supabase.from("feedback").insert({
        query: String(query).slice(0, 500),
        answer: answer ? String(answer).slice(0, 1000) : null,
        rating,
        lang: lang || "en",
        user_id: userId,
      });

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      // Non-critical — still return 200 so frontend doesn't show an error
      console.error("Feedback store error:", error.message);
      res.json({ success: false, message: "Feedback noted locally" });
    }
  });

  // ── NEW: Trending questions (in-memory) ────────────────────────────────────
  app.get("/api/trending", (req, res) => {
    const topQueries = Object.entries(trendingCounter)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([_, data]) => ({
        query: data.query,
        count: data.count,
        category: data.category,
        lang: data.lang,
      }));
    res.json({ trending: topQueries });
  });

  // ── NEW: Legal document checklist generator ────────────────────────────────
  app.post("/api/checklist", async (req, res) => {
    const { documentType, lang } = req.body;
    if (!documentType) {
      return res.status(400).json({ error: "documentType is required" });
    }

    try {
      const isUrdu = lang === "ur";
      const prompt = isUrdu
        ? `پاکستانی قانون کے مطابق "${documentType}" کے لیے مرحلہ وار مکمل چیک لسٹ بنائیں۔ ہر آئٹم ایک نئی لائن پر لکھیں، - سے شروع کریں۔ 8 سے 12 آئٹم لکھیں۔ مختصر، واضح اور عملی۔`
        : `Generate a practical step-by-step checklist for "${documentType}" under Pakistani law. List 8–12 items, one per line, each starting with "- ". Be specific and concise. No intro text, no conclusion.`;

      const content = await callGroqDirect(
        [
          {
            role: "system",
            content:
              "You are an expert Pakistani lawyer. Generate accurate, practical legal checklists.",
          },
          { role: "user", content: prompt },
        ],
        700,
      );

      const items = content
        .split("\n")
        .map((line: string) =>
          line
            .replace(/^[-•*]\s*/, "")
            .replace(/^\d+[.)]\s*/, "")
            .trim(),
        )
        .filter((line: string) => line.length > 5)
        .slice(0, 12);

      res.json({ items, documentType });
    } catch (error: any) {
      console.error("Checklist generation error:", error.message);
      res.status(500).json({ error: "Failed to generate checklist" });
    }
  });

  const isProd = process.env.NODE_ENV === "production";

  // Vite integration
  if (!isProd) {
    console.log("🚀 Starting Vite development middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Serving production build...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⚖️ QaanoonSathi server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
