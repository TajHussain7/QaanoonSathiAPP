import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiCall } from "../services/apiClient";
import {
  Send,
  Copy,
  Check,
  Trash2,
  Pin,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Scale,
  Keyboard,
  X,
  Clock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import SourceModal from "./SourceModal";
import MediaUploadWidget from "./MediaUploadWidget";

interface Result {
  answer: string;
  sources: Array<{ source: string; section: string }>;
  llmUsed?: string;
}

interface HistoryItem {
  id: number;
  query: string;
  answer: string;
  resLang: string;
  pinned?: boolean;
}

interface SearchPageProps {
  t: any;
  lang: string;
  initialCategory: string;
  userName?: string;
  token?: string | null;
}

// Urdu keyboard layout
const URDU_KEYS = [
  ["ا", "ب", "پ", "ت", "ٹ", "ث", "ج", "چ", "ح", "خ"],
  ["د", "ڈ", "ذ", "ر", "ڑ", "ز", "ژ", "س", "ش", "ص"],
  ["ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ک", "گ", "ل"],
  ["م", "ن", "و", "ہ", "ھ", "ی", "ے", "ں", "ئ", "ء"],
  ["َ", "ِ", "ُ", "ً", "ٍ", "ٌ", "ّ", "ْ", "۔", " "],
];

const UrduKeyboard: React.FC<{
  onKeyPress: (char: string) => void;
  onClose: () => void;
  onBackspace: () => void;
}> = ({ onKeyPress, onClose, onBackspace }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    className="bg-white border border-[#065016]/20 rounded-2xl shadow-2xl p-4 z-50"
  >
    <div className="flex justify-between items-center mb-3">
      <span className="text-[10px] font-black text-[#065016]/50 uppercase tracking-widest">
        Urdu Keyboard / اردو کی بورڈ
      </span>
      <button
        onClick={onClose}
        className="p-1 text-[#065016]/40 hover:text-[#065016] transition-colors"
      >
        <X size={16} />
      </button>
    </div>
    <div className="space-y-1.5">
      {URDU_KEYS.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1 justify-center flex-wrap">
          {row.map((key) => (
            <button
              key={key}
              onMouseDown={(e) => {
                e.preventDefault();
                onKeyPress(key);
              }}
              className="w-9 h-9 bg-[#FDFBF7] border border-[#065016]/10 rounded-lg font-urdu text-base text-[#065016] hover:bg-[#065016] hover:text-white hover:border-[#065016] transition-all active:scale-95 flex items-center justify-center"
            >
              {key === " " ? "⎵" : key}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1 justify-end mt-1">
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            onBackspace();
          }}
          className="px-4 h-9 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-500 hover:bg-red-100 transition-all active:scale-95"
        >
          ← Backspace
        </button>
      </div>
    </div>
  </motion.div>
);

// Detect if text contains Urdu script (Arabic Unicode block)
const containsUrdu = (text: string) => /[\u0600-\u06FF]/.test(text);

// Format answer: separate main text from disclaimer
const parseAnswer = (
  answer: string,
): { mainText: string; disclaimer: string | null } => {
  const disclaimerPattern =
    /\[?QaanoonSathi provides general legal information[^\]]*\]?/i;
  const match = answer.match(disclaimerPattern);
  if (match) {
    const idx = answer.indexOf(match[0]);
    return {
      mainText: answer.slice(0, idx).trim(),
      disclaimer: match[0].replace(/^\[|\]$/g, "").trim(),
    };
  }
  return { mainText: answer, disclaimer: null };
};

const SearchPage: React.FC<SearchPageProps> = ({
  t,
  lang,
  initialCategory,
  userName,
  token,
}) => {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [detectedCategory, setDetectedCategory] = useState(
    initialCategory || "",
  );
  const [lastResultLang, setLastResultLang] = useState<string | null>(null);
  const [sources, setSources] = useState<
    Array<{ source: string; section: string }>
  >([]);
  const [selectedSource, setSelectedSource] = useState<{
    source: string;
    section: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 1,
      query:
        lang === "ur"
          ? "بنیادی انسانی حقوق کیا ہیں؟"
          : "What are basic fundamental rights?",
      answer:
        lang === "ur"
          ? "آئین پاکستان کے تحت ہر شہری کو زندگی، آزادی اور برابری کا حق حاصل ہے۔"
          : "Under the Constitution of Pakistan, every citizen is entitled to life, liberty, and equality.",
      resLang: lang,
    },
  ]);
  const [showHistory, setShowHistory] = useState(false);
  const [showUrduKeyboard, setShowUrduKeyboard] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isInputUrdu = containsUrdu(query);

  const handleSearch = async (customQuery: string | null = null) => {
    const rawQuery = typeof customQuery === "string" ? customQuery : query;
    if (!rawQuery.trim()) return;

    setIsLoading(true);
    setAnswer("");
    setSources([]);
    setStatusMessage("Authenticating & processing...");
    setShowUrduKeyboard(false);

    try {
      const isUrduInput = containsUrdu(rawQuery);
      // If input has no Urdu script, always respond in English/Roman — regardless of UI lang
      const targetLang = isUrduInput ? "ur" : "en";
      setLastResultLang(targetLang);

      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await apiCall("/api/query", {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: rawQuery,
          category: detectedCategory,
          lang: targetLang,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Server processed poorly");

      setAnswer(data.answer);
      setSources(data.sources || []);
      setHistory((prev) => [
        {
          id: Date.now(),
          query: rawQuery,
          answer: data.answer,
          resLang: targetLang,
        },
        ...prev,
      ]);
    } catch (error: any) {
      console.error("Search failed:", error);
      setAnswer(`System Error: ${error.message || "Processing failed."}`);
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(answer).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const deleteHistoryItem = (id: number) => {
    setHistory(history.filter((item) => item.id !== id));
  };

  const togglePin = (id: number) => {
    setHistory(
      history
        .map((item) =>
          item.id === id ? { ...item, pinned: !item.pinned } : item,
        )
        .sort((a, b) => {
          if (a.pinned === b.pinned) return b.id - a.id;
          return a.pinned ? -1 : 1;
        }),
    );
  };

  const loadHistoryQuery = (item: HistoryItem) => {
    setQuery(item.query);
    setAnswer(item.answer);
    setLastResultLang(item.resLang);
    setShowHistory(false);
  };

  const handleSourceClick = (s: { source: string; section: string }) => {
    setSelectedSource(s);
    setIsModalOpen(true);
  };

  const handleUrduKeyPress = (char: string) => {
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart ?? query.length;
    const end = inputRef.current.selectionEnd ?? query.length;
    const newVal = query.slice(0, start) + char + query.slice(end);
    setQuery(newVal);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = start + char.length;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleUrduBackspace = () => {
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart ?? query.length;
    const end = inputRef.current.selectionEnd ?? query.length;
    if (start !== end) {
      const newVal = query.slice(0, start) + query.slice(end);
      setQuery(newVal);
    } else if (start > 0) {
      const newVal = query.slice(0, start - 1) + query.slice(start);
      setQuery(newVal);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(start - 1, start - 1);
        }
      }, 0);
    }
  };

  const { mainText, disclaimer } = parseAnswer(answer);

  const markdownComponents: any = {
    strong: ({ children }: any) => (
      <strong className="font-bold text-[#065016]">{children}</strong>
    ),
    b: ({ children }: any) => (
      <strong className="font-bold text-[#065016]">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em
        className={`italic ${lastResultLang === "ur" ? "font-semibold" : ""}`}
      >
        {children}
      </em>
    ),
    p: ({ children }: any) => (
      <p
        className={`mb-4 leading-[1.85] ${lastResultLang === "ur" ? "text-right" : ""}`}
      >
        {children}
      </p>
    ),
    li: ({ children }: any) => (
      <li
        className={`mb-2 leading-relaxed ${lastResultLang === "ur" ? "text-right" : ""}`}
      >
        {children}
      </li>
    ),
    ul: ({ children }: any) => (
      <ul
        className={`list-disc mb-5 space-y-1.5 ${lastResultLang === "ur" ? "mr-5 ml-0" : "ml-5"}`}
      >
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol
        className={`list-decimal mb-5 space-y-1.5 ${lastResultLang === "ur" ? "mr-5 ml-0" : "ml-5"}`}
      >
        {children}
      </ol>
    ),
    h1: ({ children }: any) => (
      <h1
        className={`text-2xl font-black mb-5 mt-7 text-[#065016] border-b border-[#065016]/10 pb-2 ${lastResultLang === "ur" ? "text-right" : ""}`}
      >
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2
        className={`text-xl font-black mb-4 mt-6 text-[#065016] ${lastResultLang === "ur" ? "text-right" : ""}`}
      >
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3
        className={`text-lg font-bold mb-3 mt-4 text-[#065016] ${lastResultLang === "ur" ? "text-right" : ""}`}
      >
        {children}
      </h3>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-[#A68A56] pl-5 py-2 bg-[#A68A56]/5 rounded-r-xl mb-4 italic text-[#2C2621]/70">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-6 font-law">
      {/* Chat History Sidebar Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2.5 text-[#065016] font-bold text-xs uppercase tracking-widest hover:text-[#065016]/70 transition-colors group"
        >
          <div className="w-7 h-7 rounded-lg bg-[#065016]/10 flex items-center justify-center group-hover:bg-[#065016]/20 transition-colors">
            <MessageSquare size={14} />
          </div>
          <span>{lang === "ur" ? "پچھلے سوالات" : "Chat History"}</span>
          <span className="bg-[#065016] text-white px-2 py-0.5 rounded-full text-[10px] font-black">
            {history.length}
          </span>
          {showHistory ? (
            <ChevronLeft size={14} className="ml-1 opacity-50" />
          ) : (
            <ChevronRight size={14} className="ml-1 opacity-50" />
          )}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 bg-white rounded-2xl border border-[#065016]/10 overflow-hidden shadow-sm">
                {/* History header */}
                <div className="px-5 py-3 bg-[#065016]/5 border-b border-[#065016]/10 flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#065016] uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} />
                    {lang === "ur"
                      ? "گفتگو کی تاریخ"
                      : "Previous Conversations"}
                  </span>
                  <span className="text-[10px] text-[#065016]/40 font-medium">
                    {lang === "ur"
                      ? "کلک کریں لوڈ کرنے کے لیے"
                      : "Click any to reload"}
                  </span>
                </div>

                {/* History list */}
                <div className="max-h-64 overflow-y-auto divide-y divide-[#065016]/5">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="px-5 py-4 hover:bg-[#FDFBF7] transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-lg bg-[#065016]/10 flex items-center justify-center text-[#065016] flex-shrink-0 mt-0.5">
                          <MessageSquare size={14} />
                        </div>

                        {/* Content */}
                        <button
                          onClick={() => loadHistoryQuery(item)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p
                            className={`text-sm font-semibold text-[#065016] hover:text-[#065016]/70 transition-colors line-clamp-1 ${item.resLang === "ur" ? "text-right font-urdu text-base" : ""}`}
                            dir={item.resLang === "ur" ? "rtl" : "ltr"}
                          >
                            {item.query}
                          </p>
                          <p
                            className={`text-[11px] text-[#065016]/40 mt-0.5 line-clamp-1 ${item.resLang === "ur" ? "text-right" : ""}`}
                            dir={item.resLang === "ur" ? "rtl" : "ltr"}
                          >
                            {item.answer?.slice(0, 70)}…
                          </p>
                        </button>

                        {/* Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => togglePin(item.id)}
                            title={item.pinned ? "Unpin" : "Pin"}
                            className={`p-1.5 rounded-lg transition-colors ${item.pinned ? "bg-[#065016]/15 text-[#065016]" : "bg-[#065016]/5 text-[#065016]/30 hover:bg-[#065016]/10 hover:text-[#065016]"}`}
                          >
                            <Pin size={13} />
                          </button>
                          <button
                            onClick={() => deleteHistoryItem(item.id)}
                            title="Delete"
                            className="p-1.5 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Media Upload Widget */}
      <div className="mb-8">
        <MediaUploadWidget
          onTextExtracted={async (text, mediaType, language) => {
            setQuery(text);
            await handleSearch(text);
          }}
          onError={(error) => {
            setStatusMessage(`Error: ${error}`);
            setTimeout(() => setStatusMessage(""), 3000);
          }}
          disabled={isLoading}
        />
      </div>

      {/* Main Search Input */}
      <div className="relative group mb-8">
        <div className="absolute -inset-1 bg-gradient-to-r from-[#065016]/20 to-[#065016]/20 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-700" />
        <div className="relative bg-white border border-[#065016]/20 rounded-[2rem] overflow-visible shadow-xl transition-all duration-500 group-focus-within:border-[#065016]/50">
          {/* Top bar */}
          <div className="flex items-center px-6 pt-4 pb-2 border-b border-[#065016]/5">
            <div className="flex items-center gap-2 text-[#065016]/30">
              <Scale size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest select-none">
                {lang === "ur" ? "اپنا قانونی سوال پوچھیں" : "Ask_Sathi"}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Urdu keyboard toggle (show when Urdu lang or Urdu text detected) */}
              {(lang === "ur" || isInputUrdu) && (
                <button
                  type="button"
                  onClick={() => setShowUrduKeyboard(!showUrduKeyboard)}
                  className={`p-1.5 rounded-lg transition-colors text-xs font-bold ${showUrduKeyboard ? "bg-[#065016] text-white" : "bg-[#065016]/10 text-[#065016]/60 hover:bg-[#065016]/20"}`}
                  title="Toggle Urdu keyboard"
                >
                  <Keyboard size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="flex items-end px-5 py-3 gap-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                lang === "ur"
                  ? "یہاں اپنا قانونی سوال لکھیں..."
                  : "Type your legal query in English or Roman..."
              }
              dir={isInputUrdu ? "rtl" : "ltr"}
              className={`flex-1 bg-transparent py-3 text-[#065016] outline-none placeholder:text-[#065016]/25 resize-none leading-relaxed
                ${
                  isInputUrdu
                    ? "font-urdu text-2xl text-right placeholder:text-right"
                    : "text-lg font-serif"
                }`}
            />
            <button
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="mb-1 w-12 h-12 bg-[#065016] text-white rounded-xl flex items-center justify-center hover:bg-[#065016]/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-wait flex-shrink-0 active:scale-95"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full"
                />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>

          {/* Character count for Urdu */}
          {isInputUrdu && query.length > 0 && (
            <div className="px-6 pb-2 text-[10px] text-[#065016]/30 font-medium text-right">
              {query.length} حروف
            </div>
          )}
        </div>

        {/* Urdu Keyboard Popover */}
        <AnimatePresence>
          {showUrduKeyboard && (
            <div className="absolute left-0 right-0 mt-2 z-50">
              <UrduKeyboard
                onKeyPress={handleUrduKeyPress}
                onClose={() => setShowUrduKeyboard(false)}
                onBackspace={handleUrduBackspace}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading indicator */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 justify-center mb-8"
          >
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-[#065016] rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-[#065016] rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-[#065016] rounded-full animate-bounce delay-200" />
            </div>
            <span className="text-[11px] text-[#065016] font-bold uppercase tracking-[0.3em]">
              {statusMessage || "Processing..."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answer Board */}
      <div className="min-h-[200px]">
        {answer && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="bg-white rounded-[2rem] shadow-lg border border-[#065016]/10 overflow-hidden"
          >
            {/* Answer header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-[#065016]/5 bg-[#065016]/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#065016] flex items-center justify-center text-white">
                  <Scale size={16} />
                </div>
                <div>
                  <span className="text-[11px] font-black text-[#065016] uppercase tracking-widest">
                    {lastResultLang === "ur" ? "قانونی جواب" : "Legal Response"}
                  </span>
                  <p className="text-[9px] text-[#065016]/40 font-medium uppercase tracking-wide mt-0.5">
                    {lastResultLang === "ur" ? "اردو" : "QaanoonSathi AI"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="p-2.5 bg-[#FDFBF7] border border-[#065016]/15 rounded-xl text-[#065016]/50 hover:bg-[#065016] hover:text-white hover:border-[#065016] transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                title="Copy answer"
              >
                {isCopied ? (
                  <>
                    <Check size={14} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy
                  </>
                )}
              </button>
            </div>

            {/* Main answer content */}
            <div
              className={`px-8 pt-8 pb-6 leading-relaxed text-[#2C2621] ${
                lastResultLang === "ur"
                  ? "text-right font-urdu text-xl md:text-2xl"
                  : "text-base md:text-lg font-serif"
              }`}
              dir={lastResultLang === "ur" ? "rtl" : "ltr"}
            >
              <div
                className={`markdown-body ${lastResultLang === "ur" ? "urdu" : ""}`}
              >
                <ReactMarkdown components={markdownComponents}>
                  {mainText}
                </ReactMarkdown>
              </div>
            </div>

            {/* Disclaimer block — separated and highlighted */}
            {disclaimer && (
              <div className="mx-8 mb-6 px-5 py-4 bg-[#A68A56]/8 border border-[#A68A56]/25 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-1 self-stretch bg-[#A68A56] rounded-full flex-shrink-0" />
                  <p className="text-[#A68A56] text-sm font-semibold leading-relaxed italic">
                    ⚖️ {disclaimer}
                  </p>
                </div>
              </div>
            )}

            {/* Sources section */}
            {sources.length > 0 && (
              <div className="px-8 pb-8 pt-2">
                <div className="border-t border-[#065016]/5 pt-5">
                  <p className="text-[10px] font-black text-[#065016]/40 uppercase tracking-[0.3em] mb-3">
                    {lastResultLang === "ur" ? "ماخذ" : "Sources"}
                  </p>
                  <div
                    className={`flex flex-wrap gap-2 ${lastResultLang === "ur" ? "justify-end" : ""}`}
                  >
                    {sources.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSourceClick(s)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FDFBF7] text-[11px] font-bold text-[#065016] border border-[#065016]/15 rounded-full hover:border-[#065016] hover:bg-[#065016]/5 transition-all cursor-pointer"
                        title={`View source: ${s.source}`}
                      >
                        <Scale size={12} />
                        {s.source.toLowerCase().replace(/ /g, "_")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <SourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        source={selectedSource}
        lang={lang}
      />
    </div>
  );
};

export default SearchPage;
