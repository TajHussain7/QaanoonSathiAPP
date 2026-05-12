import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lightbulb, ChevronRight } from "lucide-react";
import { apiCall } from "../services/apiClient";

interface Props {
  query: string;
  answer: string;
  lang: string;
  token?: string | null;
  onSelectQuestion: (q: string) => void;
}

const FollowUpSuggestions: React.FC<Props> = ({
  query,
  answer,
  lang,
  token,
  onSelectQuestion,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || !answer) return;
    let cancelled = false;

    const fetchSuggestions = async () => {
      setLoading(true);
      setSuggestions([]);
      try {
        const headers: any = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await apiCall("/api/followup", {
          method: "POST",
          headers,
          body: JSON.stringify({
            query,
            answer: answer.slice(0, 500),
            lang,
          }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.questions)) {
          setSuggestions(data.questions.slice(0, 3));
        }
      } catch {
        // Non-critical — fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [query, answer]);

  if (!loading && suggestions.length === 0) return null;

  return (
    <div className="px-8 pb-6">
      <div className="border-t border-[#065016]/5 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={13} className="text-[#A68A56]" />
          <p className="text-[10px] font-black text-[#065016]/70 uppercase tracking-[0.3em]">
            {lang === "ur" ? "مزید سوالات" : "You Might Also Ask"}
          </p>
        </div>

        <AnimatePresence>
          {loading ? (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-9 rounded-full bg-[#065016]/5 animate-pulse"
                  style={{ width: `${120 + i * 30}px` }}
                />
              ))}
            </div>
          ) : (
            <div
              className={`flex flex-wrap gap-2 ${lang === "ur" ? "justify-end" : ""}`}
            >
              {suggestions.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.09 }}
                  onClick={() => onSelectQuestion(q)}
                  dir={lang === "ur" ? "rtl" : "ltr"}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#065016]/5 text-[12px] font-semibold text-[#065016] border border-[#065016]/15 rounded-full hover:bg-[#065016] hover:text-white hover:border-[#065016] transition-all text-left active:scale-95"
                >
                  <ChevronRight size={12} className="flex-shrink-0" />
                  {q}
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FollowUpSuggestions;
