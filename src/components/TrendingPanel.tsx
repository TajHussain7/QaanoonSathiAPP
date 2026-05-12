import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, ChevronRight, Flame } from "lucide-react";
import { apiCall } from "../services/apiClient";

interface TrendingItem {
  query: string;
  count: number;
  category: string;
  lang: string;
}

interface Props {
  lang: string;
  onSelectQuestion: (q: string) => void;
}

const FALLBACK_TRENDING: TrendingItem[] = [
  {
    query:
      "What are my rights if my landlord refuses to return security deposit?",
    count: 0,
    category: "Property",
    lang: "en",
  },
  {
    query: "How to file an FIR in Pakistan?",
    count: 0,
    category: "Criminal",
    lang: "en",
  },
  {
    query: "What is the procedure for Khula divorce in Pakistan?",
    count: 0,
    category: "Family",
    lang: "en",
  },
  {
    query: "طلاق کے بعد بچوں کی حضانت کا قانون کیا ہے؟",
    count: 0,
    category: "Family",
    lang: "ur",
  },
  {
    query: "How to register a business/company in Pakistan?",
    count: 0,
    category: "Business",
    lang: "en",
  },
  {
    query: "What are worker rights under Pakistan Labour Law?",
    count: 0,
    category: "Labour",
    lang: "en",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Property: "bg-blue-50 text-blue-600 border-blue-200",
  Criminal: "bg-red-50 text-red-600 border-red-200",
  Family: "bg-pink-50 text-pink-600 border-pink-200",
  Business: "bg-purple-50 text-purple-600 border-purple-200",
  Labour: "bg-orange-50 text-orange-600 border-orange-200",
  General: "bg-gray-50 text-gray-600 border-gray-200",
  "Islamic Law": "bg-emerald-50 text-emerald-600 border-emerald-200",
  Harassment: "bg-rose-50 text-rose-600 border-rose-200",
  Inheritance: "bg-amber-50 text-amber-600 border-amber-200",
};

const TrendingPanel: React.FC<Props> = ({ lang, onSelectQuestion }) => {
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await apiCall("/api/trending");
        const data = await res.json();
        if (
          res.ok &&
          Array.isArray(data.trending) &&
          data.trending.length >= 3
        ) {
          setTrending(data.trending.slice(0, 6));
        } else {
          setTrending(FALLBACK_TRENDING);
        }
      } catch {
        setTrending(FALLBACK_TRENDING);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 bg-[#065016]/10 rounded animate-pulse" />
          <div className="w-36 h-3 bg-[#065016]/10 rounded animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 rounded-full bg-[#065016]/5 animate-pulse"
              style={{ width: `${140 + i * 25}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (trending.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
        dir={lang === "ur" ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-2 mb-4 ${lang === "ur" ? "flex-row-reverse" : ""}`}
        >
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-orange-400" />
            <TrendingUp size={13} className="text-[#065016]/50" />
          </div>
          <span className="text-[10px] font-black text-[#065016]/60 uppercase tracking-[0.25em]">
            {lang === "ur" ? "مقبول سوالات" : "Trending Questions"}
          </span>
        </div>

        {/* Questions */}
        <div
          className={`flex flex-wrap gap-2 ${lang === "ur" ? "justify-end" : ""}`}
        >
          {trending.map((item, i) => {
            const catColor =
              CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => onSelectQuestion(item.query)}
                dir={item.lang === "ur" ? "rtl" : "ltr"}
                className="group flex items-center gap-2 px-4 py-2.5 bg-white border border-[#065016]/10 rounded-full hover:border-[#065016]/30 hover:shadow-sm transition-all text-left active:scale-95"
              >
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catColor} hidden sm:inline-block flex-shrink-0`}
                >
                  {item.category}
                </span>
                <span
                  className={`text-[12px] font-semibold text-[#065016] max-w-[200px] truncate ${item.lang === "ur" ? "font-urdu text-sm" : ""}`}
                >
                  {item.query}
                </span>
                <ChevronRight
                  size={12}
                  className="text-[#065016]/30 group-hover:text-[#065016] transition-colors flex-shrink-0"
                />
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TrendingPanel;
