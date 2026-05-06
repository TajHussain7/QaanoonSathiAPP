import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiCall } from "../services/apiClient";

type PageState = "idle" | "processing" | "complete" | "error";

interface CaseTimeline {
  date: string;
  event: string;
}

interface AnalysisResult {
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

const PROCESSING_STEPS = [
  {
    id: "parse",
    label: "Parsing Document",
    urduLabel: "دستاویز پارس",
    icon: "📄",
    logs: [
      "Reading file headers and metadata...",
      "Detecting document encoding (UTF-8/Unicode)...",
      "Extracting raw text layers from document...",
      "Identifying document structure and sections...",
      "Tokenizing legal paragraphs...",
    ],
    durationMs: 3000,
  },
  {
    id: "extract",
    label: "Extracting Entities",
    urduLabel: "ادارے نکالنا",
    icon: "🔍",
    logs: [
      "Identifying parties: plaintiff, defendant, petitioner...",
      "Extracting dates, case numbers, FIR references...",
      "Detecting legal terminology and citations...",
      "Parsing court names and judicial authority...",
      "Mapping section references (PPC, CrPC, PECA)...",
    ],
    durationMs: 3000,
  },
  {
    id: "match",
    label: "Matching Laws",
    urduLabel: "قوانین کی مطابقت",
    icon: "⚖️",
    logs: [
      "Searching Pakistan Penal Code sections...",
      "Cross-referencing Code of Criminal Procedure...",
      "Checking Muslim Family Laws Ordinance 1961...",
      "Validating relevant constitutional provisions...",
      "Applying Qanun-e-Shahadat Order 1984...",
    ],
    durationMs: 3500,
  },
  {
    id: "summary",
    label: "Generating Summary",
    urduLabel: "خلاصہ تیار",
    icon: "📝",
    logs: [
      "Analyzing case context and legal standing...",
      "Building structured case summary...",
      "Formatting key findings and facts...",
      "Preparing simplified explanation for laypeople...",
      "Generating bilingual (Urdu/English) output...",
    ],
    durationMs: 3500,
  },
  {
    id: "timeline",
    label: "Predicting Timeline",
    urduLabel: "ٹائم لائن کا تخمینہ",
    icon: "📅",
    logs: [
      "Estimating court processing durations...",
      "Calculating appeal and hearing probabilities...",
      "Projecting case resolution timeframe...",
      "Analyzing precedents from Pakistani courts...",
      "Factoring in backlog and procedural delays...",
    ],
    durationMs: 3000,
  },
  {
    id: "validate",
    label: "Validating Sources",
    urduLabel: "ذرائع کی تصدیق",
    icon: "✅",
    logs: [
      "Verifying all legal citations and references...",
      "Checking for recent amendments (2020–2024)...",
      "Cross-validating with Supabase legal database...",
      "Computing confidence scores per section...",
      "Finalizing comprehensive legal analysis...",
    ],
    durationMs: 2500,
  },
];

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/msword": [".doc"],
};
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📕";
  return "📘";
}

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
  const label =
    score >= 80 ? "High Confidence" : score >= 60 ? "Moderate" : "Low";
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${color}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {score}% — {label}
    </span>
  );
}

interface DocumentAnalysisProps {
  lang: string;
}

const DocumentAnalysis: React.FC<DocumentAnalysisProps> = ({ lang }) => {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");
  const [analysisLang, setAnalysisLang] = useState<"en" | "ur">(
    lang === "ur" ? "ur" : "en",
  );

  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<
    Array<{ step: number; msg: string; ts: string }>
  >([]);
  const [activeStepLogs, setActiveStepLogs] = useState<string[]>([]);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<
    "summary" | "details" | "analysis"
  >("summary");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const clearTimers = () => {
    animTimers.current.forEach(clearTimeout);
    animTimers.current = [];
  };

  const validateFile = (f: File): string => {
    if (!ACCEPTED_TYPES[f.type])
      return "Only PDF, DOC, and DOCX files are accepted.";
    if (f.size > MAX_FILE_SIZE)
      return `File too large (${formatBytes(f.size)}). Maximum allowed size is 20 MB.`;
    return "";
  };

  const onFileSelect = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setFileError(err);
      setFile(null);
    } else {
      setFileError("");
      setFile(f);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileSelect(dropped);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  const addLog = (step: number, msg: string) => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setLogs((prev) => [...prev, { step, msg, ts }]);
  };

  const runAnimationAndFetch = async () => {
    setPageState("processing");
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setProgress(0);
    setLogs([]);
    setActiveStepLogs([]);
    clearTimers();

    const totalDuration = PROCESSING_STEPS.reduce(
      (acc, s) => acc + s.durationMs,
      0,
    );

    let elapsed = 0;
    let apiDone = false;
    let apiResult: AnalysisResult | null = null;
    let apiError: string | null = null;

    const apiPromise = (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file!);
        formData.append("lang", analysisLang);
        const res = await apiCall("/api/analyze-document", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Analysis failed");
        apiResult = data as AnalysisResult;
      } catch (e: any) {
        apiError = e.message || "Document analysis failed. Please try again.";
      } finally {
        apiDone = true;
      }
    })();

    const runStep = (stepIndex: number, startAt: number) => {
      const step = PROCESSING_STEPS[stepIndex];
      const progressStart = (startAt / totalDuration) * 100;
      const progressEnd = ((startAt + step.durationMs) / totalDuration) * 100;

      const t0 = setTimeout(() => {
        setCurrentStep(stepIndex);
        setActiveStepLogs([]);

        const logInterval = step.durationMs / (step.logs.length + 1);
        step.logs.forEach((logMsg, li) => {
          const t = setTimeout(
            () => {
              addLog(stepIndex, logMsg);
              setActiveStepLogs((prev) => [...prev, logMsg]);
            },
            logInterval * (li + 1),
          );
          animTimers.current.push(t);
        });

        const TICKS = 30;
        for (let i = 0; i <= TICKS; i++) {
          const t = setTimeout(
            () => {
              const frac = i / TICKS;
              setProgress(
                Math.min(
                  100,
                  progressStart + (progressEnd - progressStart) * frac,
                ),
              );
            },
            (step.durationMs / TICKS) * i,
          );
          animTimers.current.push(t);
        }
      }, startAt);
      animTimers.current.push(t0);

      const tDone = setTimeout(
        () => {
          setCompletedSteps((prev) => new Set([...prev, stepIndex]));
        },
        startAt + step.durationMs - 50,
      );
      animTimers.current.push(tDone);
    };

    let offset = 0;
    PROCESSING_STEPS.forEach((step, i) => {
      runStep(i, offset);
      elapsed = offset + step.durationMs;
      offset = elapsed;
    });

    const tFinalize = setTimeout(async () => {
      if (!apiDone) {
        addLog(5, "Waiting for AI analysis to complete...");
        await apiPromise;
      }
      if (apiError) {
        setErrorMsg(apiError);
        setPageState("error");
      } else {
        setResult(apiResult);
        setProgress(100);
        setPageState("complete");
      }
    }, elapsed + 200);
    animTimers.current.push(tFinalize);

    await apiPromise;
  };

  const handleAnalyze = () => {
    if (!file) return;
    runAnimationAndFetch();
  };

  const handleReset = () => {
    clearTimers();
    setFile(null);
    setFileError("");
    setPageState("idle");
    setResult(null);
    setErrorMsg("");
    setCurrentStep(-1);
    setCompletedSteps(new Set());
    setProgress(0);
    setLogs([]);
    setActiveStepLogs([]);
    setActiveTab("summary");
  };

  const handleDownload = (language: "en" | "ur") => {
    if (!result) return;
    const isUrdu = language === "ur";
    const title = isUrdu
      ? "قانونی تجزیہ رپورٹ — قانون ساتھی"
      : "Legal Analysis Report — QaanoonSathi";

    const content = isUrdu
      ? `${title}\n${"=".repeat(60)}\n\n${result.urduExplanation}\n\n${result.caseDetails.applicableLaws.map((l) => `• ${l}`).join("\n")}\n\n[QaanoonSathi صرف عمومی قانونی معلومات فراہم کرتا ہے۔ مستند وکیل سے مشورہ کریں۔]`
      : `${title}\n${"=".repeat(60)}\n\nCASE SUMMARY\n${result.caseSummary}\n\nSIMPLIFIED EXPLANATION\n${result.simplifiedExplanation}\n\nCASE DETAILS\nType: ${result.caseDetails.type}\nCourt: ${result.caseDetails.court}\nLegal Section: ${result.caseDetails.legalSection}\nPunishment: ${result.caseDetails.punishment}\nEstimated Duration: ${result.caseDetails.estimatedYears}\nConfidence: ${result.caseDetails.confidenceScore}%\n\nAPPLICABLE LAWS\n${result.caseDetails.applicableLaws.map((l) => `• ${l}`).join("\n")}\n\nCOMPREHENSIVE ANALYSIS\n${result.comprehensiveAnalysis.finalAnalysis}\n\nWHAT HAPPENED\n${result.comprehensiveAnalysis.whatHappened}\n\nSTEPS TO TAKE\n${result.comprehensiveAnalysis.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nPAKISTANI COURTS\n${result.comprehensiveAnalysis.pakistaniCourts}\n\nNOTE\n${result.comprehensiveAnalysis.note}\n\n[QaanoonSathi provides general legal information only and is not a substitute for professional legal advice.]`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isUrdu ? "قانونی_تجزیہ.txt" : "legal_analysis.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isUrdu = lang === "ur";

  return (
    <div className="min-h-screen" dir={isUrdu ? "rtl" : "ltr"}>
      <AnimatePresence mode="wait">
        {pageState === "idle" && (
          <UploadScreen
            key="upload"
            file={file}
            fileError={fileError}
            dragOver={dragOver}
            analysisLang={analysisLang}
            lang={lang}
            fileInputRef={fileInputRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onFileSelect={onFileSelect}
            setAnalysisLang={setAnalysisLang}
            onAnalyze={handleAnalyze}
          />
        )}

        {pageState === "processing" && (
          <ProcessingScreen
            key="processing"
            currentStep={currentStep}
            completedSteps={completedSteps}
            progress={progress}
            logs={logs}
            logsEndRef={logsEndRef}
            lang={lang}
          />
        )}

        {pageState === "complete" && result && (
          <ResultsScreen
            key="results"
            result={result}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            lang={lang}
            onDownload={handleDownload}
            onReset={handleReset}
          />
        )}

        {pageState === "error" && (
          <ErrorScreen
            key="error"
            message={errorMsg}
            lang={lang}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface UploadScreenProps {
  file: File | null;
  fileError: string;
  dragOver: boolean;
  analysisLang: "en" | "ur";
  lang: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onFileSelect: (f: File) => void;
  setAnalysisLang: (l: "en" | "ur") => void;
  onAnalyze: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({
  file,
  fileError,
  dragOver,
  analysisLang,
  lang,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  setAnalysisLang,
  onAnalyze,
}) => {
  const isUrdu = lang === "ur";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-[#065016] mb-6 shadow-[8px_8px_0px_0px_rgba(166,138,86,0.25)] rotate-3"
          >
            <span className="text-3xl -rotate-3">⚖️</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-4xl font-black text-[#065016] mb-3 ${isUrdu ? "font-urdu" : "font-law"}`}
          >
            {isUrdu ? "دستاویز تجزیہ" : "Document Analysis"}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`text-[#2C2621]/60 max-w-xl mx-auto leading-relaxed ${isUrdu ? "font-urdu text-lg" : "text-base"}`}
          >
            {isUrdu
              ? "اپنی قانونی دستاویز (FIR، کنٹریکٹ، عدالتی حکم) اپ لوڈ کریں اور مکمل قانونی تجزیہ حاصل کریں"
              : "Upload your legal document — FIR, contract, court order, or legal brief — and receive a comprehensive AI-powered legal analysis grounded in Pakistani law."}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          {[
            {
              icon: "📋",
              label: isUrdu ? "FIR" : "FIR",
              sub: isUrdu ? "فرسٹ انفارمیشن رپورٹ" : "First Information Report",
            },
            {
              icon: "📜",
              label: isUrdu ? "معاہدہ" : "Contract",
              sub: isUrdu ? "قانونی معاہدے" : "Legal Agreements",
            },
            {
              icon: "🏛️",
              label: isUrdu ? "عدالتی حکم" : "Court Order",
              sub: isUrdu ? "فیصلے اور احکامات" : "Judgments & Orders",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="text-center p-4 bg-white border border-[#065016]/8 rounded-2xl shadow-sm"
            >
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs font-black text-[#065016] uppercase tracking-wide">
                {item.label}
              </div>
              <div className="text-[10px] text-[#2C2621]/50 mt-0.5">
                {item.sub}
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 ${
            dragOver
              ? "border-[#065016] bg-[#065016]/5 scale-[1.01]"
              : file
                ? "border-[#A68A56] bg-[#A68A56]/5"
                : "border-[#065016]/20 bg-white hover:border-[#065016]/40 hover:bg-[#065016]/3"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelect(f);
            }}
          />

          {file ? (
            <div>
              <div className="text-5xl mb-4">{getFileIcon(file.type)}</div>
              <div className="font-black text-[#065016] text-lg mb-1">
                {file.name}
              </div>
              <div className="text-sm text-[#2C2621]/50 mb-3">
                {formatBytes(file.size)}
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#A68A56]/10 border border-[#A68A56]/30 rounded-full text-xs font-bold text-[#A68A56]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A68A56]" />
                {isUrdu ? "فائل منتخب ہوئی" : "File selected — click to change"}
              </div>
            </div>
          ) : (
            <div>
              <div
                className={`text-5xl mb-4 transition-transform duration-300 ${dragOver ? "scale-125" : ""}`}
              >
                📂
              </div>
              <div
                className={`font-black text-[#065016] text-xl mb-2 ${isUrdu ? "font-urdu" : "font-law"}`}
              >
                {isUrdu ? "فائل یہاں ڈراپ کریں" : "Drop your document here"}
              </div>
              <div className="text-sm text-[#2C2621]/50 mb-4">
                {isUrdu
                  ? "یا کلک کریں فائل منتخب کرنے کے لیے"
                  : "or click to browse files"}
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {["PDF", "DOC", "DOCX"].map((ext) => (
                  <span
                    key={ext}
                    className="px-3 py-1 bg-[#065016]/8 rounded-lg text-xs font-black text-[#065016] uppercase tracking-wide"
                  >
                    {ext}
                  </span>
                ))}
                <span className="text-xs text-[#2C2621]/40">
                  {isUrdu ? "زیادہ سے زیادہ ۲۰ ایم بی" : "Max 20 MB"}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {fileError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 text-red-600 text-sm font-medium"
          >
            <span>⚠️</span> {fileError}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 p-5 bg-white border border-[#065016]/10 rounded-2xl"
        >
          <div
            className={`text-xs font-black text-[#065016] uppercase tracking-widest mb-3 ${isUrdu ? "font-urdu text-right" : ""}`}
          >
            {isUrdu ? "تجزیہ کی زبان" : "Analysis Language"}
          </div>
          <div className="flex bg-[#065016]/5 rounded-xl p-1 border border-[#065016]/10 max-w-xs">
            <button
              onClick={() => setAnalysisLang("en")}
              className={`flex-1 py-2.5 rounded-lg font-black text-sm transition-all ${
                analysisLang === "en"
                  ? "bg-[#065016] text-white shadow-md"
                  : "text-[#065016]/60 hover:text-[#065016]"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setAnalysisLang("ur")}
              className={`flex-1 py-2.5 rounded-lg font-urdu text-xl font-black transition-all ${
                analysisLang === "ur"
                  ? "bg-[#065016] text-white shadow-md"
                  : "text-[#065016]/60 hover:text-[#065016]"
              }`}
            >
              اردو
            </button>
          </div>
          <p className="text-xs text-[#2C2621]/40 mt-2">
            {isUrdu
              ? "نتائج اس زبان میں فراہم کیے جائیں گے"
              : "Results will be provided in the selected language (Urdu explanation always included)."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6"
        >
          <button
            onClick={onAnalyze}
            disabled={!file || !!fileError}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all duration-300 shadow-lg ${
              file && !fileError
                ? "bg-[#065016] text-[#FDFBF7] hover:bg-[#065016]/90 hover:shadow-xl active:scale-[0.98] cursor-pointer"
                : "bg-[#065016]/20 text-[#065016]/40 cursor-not-allowed"
            }`}
          >
            {isUrdu ? "تجزیہ شروع کریں ←" : "Analyse Document →"}
          </button>
          <p className="text-center text-xs text-[#2C2621]/40 mt-3">
            {isUrdu
              ? "آپ کی دستاویز محفوظ اور رازدارانہ ہے"
              : "Your document is processed securely and not stored."}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

interface ProcessingScreenProps {
  currentStep: number;
  completedSteps: Set<number>;
  progress: number;
  logs: Array<{ step: number; msg: string; ts: string }>;
  logsEndRef: React.RefObject<HTMLDivElement>;
  lang: string;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  currentStep,
  completedSteps,
  progress,
  logs,
  logsEndRef,
  lang,
}) => {
  const isUrdu = lang === "ur";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2
            className={`text-3xl font-black text-[#065016] mb-2 ${isUrdu ? "font-urdu" : "font-law"}`}
          >
            {isUrdu ? "تجزیہ جاری ہے..." : "Analysing Your Document..."}
          </h2>
          <p
            className={`text-[#2C2621]/50 text-sm ${isUrdu ? "font-urdu" : ""}`}
          >
            {isUrdu
              ? "براہ کرم انتظار کریں، AI آپ کی دستاویز پر کام کر رہا ہے"
              : "Please wait while our AI processes your legal document"}
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-[#065016] uppercase tracking-widest">
              {isUrdu ? "پیشرفت" : "Progress"}
            </span>
            <span className="text-sm font-black text-[#A68A56]">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 bg-[#065016]/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#065016] to-[#A68A56] rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {PROCESSING_STEPS.map((step, index) => {
              const isDone = completedSteps.has(index);
              const isActive = currentStep === index && !isDone;
              const isPending = index > currentStep;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${
                    isDone
                      ? "bg-[#065016]/5 border-[#065016]/15"
                      : isActive
                        ? "bg-white border-[#A68A56]/40 shadow-lg shadow-[#A68A56]/10"
                        : "bg-white border-[#065016]/8 opacity-50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                      isDone
                        ? "bg-[#065016] text-white"
                        : isActive
                          ? "bg-[#A68A56] text-white"
                          : "bg-[#065016]/8 text-[#065016]/30"
                    }`}
                  >
                    {isDone ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : isActive ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <span className="text-lg">{step.icon}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-black text-sm ${isDone ? "text-[#065016]" : isActive ? "text-[#2C2621]" : "text-[#2C2621]/40"}`}
                    >
                      {isUrdu ? step.urduLabel : step.label}
                    </div>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-[#A68A56] font-medium mt-0.5 truncate"
                      >
                        Processing...
                      </motion.div>
                    )}
                    {isDone && (
                      <div className="text-xs text-[#065016]/50 font-medium mt-0.5">
                        Complete
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {isDone && (
                      <span className="text-[10px] font-black text-[#065016]/50 uppercase tracking-wider">
                        ✓ Done
                      </span>
                    )}
                    {isActive && (
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{
                              repeat: Infinity,
                              duration: 1.2,
                              delay: i * 0.2,
                            }}
                            className="w-1.5 h-1.5 rounded-full bg-[#A68A56]"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="bg-[#0A0A0A] rounded-3xl p-5 font-mono text-xs h-[420px] overflow-y-auto border border-[#065016]/20 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="text-white/40 text-[10px] uppercase tracking-widest ml-2">
                QaanoonSathi AI Engine v2.0
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="text-[#A68A56]/70 text-[10px]">
                $ qaanoon-analyze --lang {lang} --deep-scan
              </div>
              <div className="text-green-400/60 text-[10px] mb-3">
                ✓ System initialized. Starting pipeline...
              </div>
              <AnimatePresence>
                {logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-3 leading-relaxed"
                  >
                    <span className="text-white/20 text-[10px] flex-shrink-0 tabular-nums">
                      {log.ts}
                    </span>
                    <span
                      className={`text-[11px] ${
                        log.step === currentStep
                          ? "text-[#A68A56]"
                          : completedSteps.has(log.step)
                            ? "text-green-400/80"
                            : "text-white/60"
                      }`}
                    >
                      [{PROCESSING_STEPS[log.step]?.id?.toUpperCase()}]{" "}
                      {log.msg}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {currentStep >= 0 &&
                !completedSteps.has(PROCESSING_STEPS.length - 1) && (
                  <motion.div
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="text-[#A68A56] text-sm mt-1"
                  >
                    ▋
                  </motion.div>
                )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface ResultsScreenProps {
  result: AnalysisResult;
  activeTab: "summary" | "details" | "analysis";
  setActiveTab: (t: "summary" | "details" | "analysis") => void;
  lang: string;
  onDownload: (language: "en" | "ur") => void;
  onReset: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({
  result,
  activeTab,
  setActiveTab,
  lang,
  onDownload,
  onReset,
}) => {
  const isUrdu = lang === "ur";
  const score = result.caseDetails.confidenceScore;

  const tabs = [
    { id: "summary" as const, label: isUrdu ? "خلاصہ" : "Summary", icon: "📋" },
    {
      id: "details" as const,
      label: isUrdu ? "تفصیلات" : "Case Details",
      icon: "⚖️",
    },
    {
      id: "analysis" as const,
      label: isUrdu ? "مکمل تجزیہ" : "Full Analysis",
      icon: "🔬",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-black text-green-700 uppercase tracking-widest">
              {isUrdu ? "تجزیہ مکمل" : "Analysis Complete"}
            </span>
          </div>
          <h2
            className={`text-3xl font-black text-[#065016] ${isUrdu ? "font-urdu" : "font-law"}`}
          >
            {isUrdu ? "قانونی رپورٹ" : "Legal Analysis Report"}
          </h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onDownload("en")}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#065016]/20 rounded-xl text-xs font-black text-[#065016] hover:border-[#065016]/50 hover:bg-[#065016]/5 transition-all"
          >
            ↓ {isUrdu ? "انگریزی رپورٹ" : "Download EN"}
          </button>
          <button
            onClick={() => onDownload("ur")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#065016] rounded-xl text-xs font-black text-white hover:bg-[#065016]/90 transition-all"
          >
            ↓ {isUrdu ? "اردو رپورٹ" : "Download اردو"}
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#2C2621]/10 rounded-xl text-xs font-black text-[#2C2621]/60 hover:border-[#2C2621]/30 transition-all"
          >
            ↺ {isUrdu ? "نئی دستاویز" : "New Document"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard
          icon="🏛️"
          label={isUrdu ? "قسم" : "Type"}
          value={result.caseDetails.type}
        />
        <StatCard
          icon="📊"
          label={isUrdu ? "اعتماد" : "Confidence"}
          value={<ConfidenceBadge score={score} />}
        />
        <StatCard
          icon="⏳"
          label={isUrdu ? "متوقع مدت" : "Est. Duration"}
          value={result.caseDetails.estimatedYears}
        />
        <StatCard
          icon="⚖️"
          label={isUrdu ? "عدالت" : "Court"}
          value={result.caseDetails.court || "—"}
        />
      </div>

      <div className="flex gap-1 bg-[#065016]/5 p-1 rounded-2xl mb-6 border border-[#065016]/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-sm transition-all duration-300 ${
              activeTab === tab.id
                ? "bg-[#065016] text-white shadow-md"
                : "text-[#065016]/60 hover:text-[#065016]"
            }`}
          >
            <span>{tab.icon}</span>
            <span className={`hidden sm:block ${isUrdu ? "font-urdu" : ""}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "summary" && (
          <SummaryTab key="summary" result={result} lang={lang} />
        )}
        {activeTab === "details" && (
          <DetailsTab key="details" result={result} lang={lang} />
        )}
        {activeTab === "analysis" && (
          <AnalysisTab key="analysis" result={result} lang={lang} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#065016]/8 rounded-2xl p-4 shadow-sm">
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-[10px] font-black text-[#2C2621]/40 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-xs font-black text-[#2C2621] leading-snug">
        {value}
      </div>
    </div>
  );
}

const SummaryTab: React.FC<{ result: AnalysisResult; lang: string }> = ({
  result,
  lang,
}) => {
  const isUrdu = lang === "ur";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      <Section
        title={isUrdu ? "کیس کا خلاصہ" : "Case Summary"}
        icon="📋"
        accent="green"
      >
        <p className="text-[#2C2621]/80 leading-relaxed text-sm">
          {result.caseSummary}
        </p>
      </Section>

      <Section
        title={isUrdu ? "سادہ الفاظ میں وضاحت" : "Simplified Explanation"}
        icon="💡"
        accent="gold"
      >
        <p className="text-[#2C2621]/80 leading-relaxed text-sm">
          {result.simplifiedExplanation}
        </p>
      </Section>

      {result.urduExplanation && (
        <Section title="اردو میں وضاحت" icon="🇵🇰" accent="green">
          <p
            className="font-urdu text-[#2C2621]/80 leading-[2.2] text-base"
            dir="rtl"
          >
            {result.urduExplanation}
          </p>
        </Section>
      )}
    </motion.div>
  );
};

const DetailsTab: React.FC<{ result: AnalysisResult; lang: string }> = ({
  result,
  lang,
}) => {
  const isUrdu = lang === "ur";
  const d = result.caseDetails;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailRow label={isUrdu ? "قسم" : "Document Type"} value={d.type} />
        <DetailRow
          label={isUrdu ? "عدالت" : "Court"}
          value={d.court || "N/A"}
        />
        <DetailRow
          label={isUrdu ? "قانونی دفعہ" : "Legal Section"}
          value={d.legalSection || "N/A"}
        />
        <DetailRow
          label={isUrdu ? "سزا" : "Punishment"}
          value={d.punishment || "N/A"}
        />
        <DetailRow
          label={isUrdu ? "اعتماد سکور" : "Confidence Score"}
          value={<ConfidenceBadge score={d.confidenceScore} />}
        />
        <DetailRow
          label={isUrdu ? "متوقع مدت" : "Estimated Duration"}
          value={d.estimatedYears || "N/A"}
        />
      </div>

      {d.applicableLaws && d.applicableLaws.length > 0 && (
        <Section
          title={isUrdu ? "متعلقہ قوانین" : "Applicable Laws"}
          icon="📚"
          accent="green"
        >
          <div className="space-y-2">
            {d.applicableLaws.map((law, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-[#065016]/4 rounded-xl border border-[#065016]/8"
              >
                <span className="w-6 h-6 rounded-lg bg-[#065016] text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-[#2C2621]/80 leading-snug">
                  {law}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.timeline && d.timeline.length > 0 && (
        <Section
          title={isUrdu ? "کیس ٹائم لائن" : "Case Timeline"}
          icon="📅"
          accent="gold"
        >
          <div className="relative space-y-0">
            {d.timeline.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-[#A68A56] mt-1 flex-shrink-0 shadow-sm" />
                  {i < d.timeline.length - 1 && (
                    <div className="w-0.5 bg-[#A68A56]/20 flex-1 my-1" />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <div className="text-[10px] font-black text-[#A68A56] uppercase tracking-widest mb-0.5">
                    {item.date}
                  </div>
                  <div className="text-sm text-[#2C2621]/80">{item.event}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </motion.div>
  );
};

const AnalysisTab: React.FC<{ result: AnalysisResult; lang: string }> = ({
  result,
  lang,
}) => {
  const isUrdu = lang === "ur";
  const ca = result.comprehensiveAnalysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {ca.firNumber && (
        <div className="flex items-center gap-3 p-4 bg-[#A68A56]/8 border border-[#A68A56]/20 rounded-2xl">
          <span className="text-2xl">📑</span>
          <div>
            <div className="text-[10px] font-black text-[#A68A56] uppercase tracking-widest">
              {isUrdu ? "FIR نمبر" : "FIR Number"}
            </div>
            <div className="font-black text-[#2C2621]">{ca.firNumber}</div>
          </div>
        </div>
      )}

      <Section
        title={isUrdu ? "مکمل قانونی تجزیہ" : "Final Legal Analysis"}
        icon="🔬"
        accent="green"
      >
        <p className="text-[#2C2621]/80 leading-relaxed text-sm whitespace-pre-line">
          {ca.finalAnalysis}
        </p>
      </Section>

      {ca.whatHappened && (
        <Section
          title={isUrdu ? "کیا ہوا؟" : "What Happened"}
          icon="📖"
          accent="gold"
        >
          <p className="text-[#2C2621]/80 leading-relaxed text-sm">
            {ca.whatHappened}
          </p>
        </Section>
      )}

      {ca.steps && ca.steps.length > 0 && (
        <Section
          title={isUrdu ? "اگلے اقدامات" : "Steps to Take"}
          icon="✅"
          accent="green"
        >
          <div className="space-y-2.5">
            {ca.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-[#065016] text-white text-xs font-black flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-[#2C2621]/80 leading-relaxed flex-1">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {ca.whatItMatters && (
        <Section
          title={isUrdu ? "یہ کیوں اہم ہے؟" : "Why It Matters"}
          icon="⚠️"
          accent="gold"
        >
          <p className="text-[#2C2621]/80 leading-relaxed text-sm">
            {ca.whatItMatters}
          </p>
        </Section>
      )}

      {ca.pakistaniCourts && (
        <Section
          title={
            isUrdu
              ? "پاکستانی عدالتیں"
              : "Pakistani Courts — How They Handle This"
          }
          icon="🏛️"
          accent="green"
        >
          <p className="text-[#2C2621]/80 leading-relaxed text-sm">
            {ca.pakistaniCourts}
          </p>
        </Section>
      )}

      {ca.evolution && (
        <Section
          title={isUrdu ? "قانونی ارتقاء" : "Legal Evolution"}
          icon="📈"
          accent="gold"
        >
          <p className="text-[#2C2621]/80 leading-relaxed text-sm">
            {ca.evolution}
          </p>
        </Section>
      )}

      {ca.note && (
        <div className="p-5 bg-[#A68A56]/6 border border-[#A68A56]/20 rounded-2xl flex gap-4">
          <div className="w-1 rounded-full bg-[#A68A56] flex-shrink-0" />
          <div>
            <div className="text-[10px] font-black text-[#A68A56] uppercase tracking-widest mb-1.5">
              {isUrdu ? "نوٹ" : "Important Note"}
            </div>
            <p className="text-xs text-[#A68A56]/80 leading-relaxed font-medium italic">
              {ca.note}
            </p>
          </div>
        </div>
      )}

      <div className="p-5 bg-[#065016]/5 border border-[#065016]/10 rounded-2xl flex gap-4">
        <div className="w-1 rounded-full bg-[#065016] flex-shrink-0" />
        <p className="text-xs text-[#065016]/60 leading-relaxed font-medium italic">
          {isUrdu
            ? "[قانون ساتھی صرف عمومی قانونی معلومات فراہم کرتا ہے اور پیشہ ورانہ قانونی مشورے کا متبادل نہیں ہے۔]"
            : "[QaanoonSathi provides general legal information only and is not a substitute for professional legal advice. Always consult a licensed Pakistani attorney (Vakeel).]"}
        </p>
      </div>
    </motion.div>
  );
};

function Section({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: string;
  accent: "green" | "gold";
  children: React.ReactNode;
}) {
  const border =
    accent === "green" ? "border-[#065016]/10" : "border-[#A68A56]/20";
  const headerBg = accent === "green" ? "bg-[#065016]/5" : "bg-[#A68A56]/8";

  return (
    <div
      className={`bg-white border ${border} rounded-2xl overflow-hidden shadow-sm`}
    >
      <div
        className={`flex items-center gap-3 px-5 py-3.5 ${headerBg} border-b ${border}`}
      >
        <span className="text-lg">{icon}</span>
        <h3 className="font-black text-[#065016] text-sm uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#065016]/8 rounded-2xl p-4 shadow-sm">
      <div className="text-[10px] font-black text-[#2C2621]/40 uppercase tracking-widest mb-1.5">
        {label}
      </div>
      <div className="text-sm font-bold text-[#2C2621]">{value}</div>
    </div>
  );
}

interface ErrorScreenProps {
  message: string;
  lang: string;
  onReset: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  message,
  lang,
  onReset,
}) => {
  const isUrdu = lang === "ur";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-lg mx-auto text-center py-16"
    >
      <div className="text-6xl mb-6">⚠️</div>
      <h3
        className={`text-2xl font-black text-[#065016] mb-3 ${isUrdu ? "font-urdu" : "font-law"}`}
      >
        {isUrdu ? "تجزیہ ناکام ہوا" : "Analysis Failed"}
      </h3>
      <p className="text-sm text-[#2C2621]/60 mb-8 leading-relaxed">
        {message}
      </p>
      <button
        onClick={onReset}
        className="px-8 py-4 bg-[#065016] text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#065016]/90 transition-all active:scale-95"
      >
        {isUrdu ? "دوبارہ کوشش کریں" : "Try Again"}
      </button>
    </motion.div>
  );
};

export default DocumentAnalysis;
