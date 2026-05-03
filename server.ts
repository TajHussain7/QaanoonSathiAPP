import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const { supabase } =
        await import("./src/services/backend/supabaseClient.js");
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
      const { supabase } =
        await import("./src/services/backend/supabaseClient.js");
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
      const { supabase } =
        await import("./src/services/backend/supabaseClient.js");
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
      const { supabase } =
        await import("./src/services/backend/supabaseClient.js");
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
      const { searchSimilarChunks } =
        await import("./src/services/backend/supabaseClient.js");
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
      const { cleanAndNormalizeQuery } =
        await import("./src/services/backend/inputProcessor.js");
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
      const { extractTextFromMedia } =
        await import("./src/services/backend/inputProcessor.js");
      const extracted = await extractTextFromMedia(fileData, mimeType);
      res.json({ extracted });
    } catch (error) {
      res.status(500).json({ error: "Media processing failed" });
    }
  });

  // legacy RAG Query Route (kept for compatibility during migration)
  app.post("/api/query", async (req, res) => {
    const { query, category, lang } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    try {
      let userId: string | undefined;
      const token = req.headers.authorization?.split(" ")[1];

      if (token && token !== "null") {
        const { supabase } =
          await import("./src/services/backend/supabaseClient.js");
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user) {
          userId = userData.user.id;
        }
      }

      const { performRagQuery } =
        await import("./src/services/backend/ragEngine.js");
      const result = await performRagQuery(query, category, lang, userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing query:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
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
