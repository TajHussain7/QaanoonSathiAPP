import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Clock,
  Zap,
  ChevronRight,
  BookOpen,
  User,
  Calendar,
  Search,
  TrendingUp,
  Globe,
} from "lucide-react";
import { apiCall } from "../services/apiClient";

interface DashboardProps {
  user: any;
  lang: string;
  token: string | null;
  setCurrentPage: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  user,
  lang,
  token,
  setCurrentPage,
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiCall("/api/auth/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchHistory();
  }, [token]);

  const isRtl = lang === "ur";
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Citizen";
  const totalQueries = history.length;
  const urduQueries = history.filter((h) => h.lang === "ur").length;
  const englishQueries = totalQueries - urduQueries;

  const categoryCount: Record<string, number> = {};
  history.forEach((h) => {
    const cat = h.category || "General";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const topCategory =
    Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return (
    <div
      className="max-w-5xl mx-auto py-10 px-4 md:px-6 animate-in"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Profile Header */}
      <div className="bg-white rounded-[2rem] shadow-md border border-[#A68A56]/20 mb-8 overflow-hidden">
        <div className="bg-gradient-to-r from-[#065016] to-[#065016]/80 px-8 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center text-2xl font-black border-2 border-white/30 flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2
                className={`text-2xl md:text-3xl font-black text-white tracking-tight ${isRtl ? "font-urdu" : "font-law"}`}
              >
                {isRtl
                  ? `خوش آمدید، ${user?.user_metadata?.full_name || "پاکستانی"}`
                  : `Welcome back, ${user?.user_metadata?.full_name || "Citizen"}`}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <p className="text-white/70 text-sm font-medium">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => setCurrentPage("search")}
              className={`flex items-center gap-2 px-5 py-3 bg-white text-[#065016] rounded-xl font-bold text-sm hover:bg-white/90 transition-all shadow-md active:scale-95 whitespace-nowrap ${isRtl ? "font-urdu" : ""}`}
            >
              <Search size={16} />
              {isRtl ? "نیا سوال" : "Ask a Question"}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#065016]/10 border-t border-[#065016]/10">
          {[
            {
              icon: <MessageSquare size={18} />,
              label: isRtl ? "کل سوالات" : "Total Queries",
              value: totalQueries,
              color: "text-[#065016]",
            },
            {
              icon: <Globe size={18} />,
              label: isRtl ? "اردو میں" : "Urdu Queries",
              value: urduQueries,
              color: "text-[#A68A56]",
            },
            {
              icon: <TrendingUp size={18} />,
              label: isRtl ? "انگریزی میں" : "English Queries",
              value: englishQueries,
              color: "text-[#065016]",
            },
            {
              icon: <BookOpen size={18} />,
              label: isRtl ? "اہم زمرہ" : "Top Category",
              value: topCategory,
              color: "text-[#A68A56]",
              isText: true,
            },
          ].map((stat, i) => (
            <div key={i} className="px-6 py-5 flex flex-col gap-1">
              <div className={`${stat.color} opacity-60`}>{stat.icon}</div>
              <div
                className={`font-black text-2xl text-[#2C2621] ${stat.isText ? "text-base truncate" : ""}`}
              >
                {stat.value}
              </div>
              <div className="text-[#2C2621]/40 text-[11px] font-medium uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat History Section */}
      <div className="flex items-center justify-between mb-5">
        <h3
          className={`font-black text-[#2C2621]/50 uppercase tracking-widest text-sm flex items-center gap-2 ${isRtl ? "font-urdu text-base" : ""}`}
        >
          <Clock size={16} />
          {isRtl ? "آپ کی گفتگو کی تاریخ" : "Conversation History"}
        </h3>
        {totalQueries > 0 && (
          <span className="text-xs font-bold text-[#A68A56] bg-[#A68A56]/10 px-3 py-1 rounded-full">
            {totalQueries} {isRtl ? "سوالات" : "queries"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 bg-[#065016] rounded-full animate-bounce"></div>
            <div className="w-2.5 h-2.5 bg-[#065016] rounded-full animate-bounce delay-100"></div>
            <div className="w-2.5 h-2.5 bg-[#065016] rounded-full animate-bounce delay-200"></div>
          </div>
          <p className="text-[#A68A56] font-semibold text-sm">
            {isRtl ? "لوڈ ہو رہا ہے..." : "Loading history..."}
          </p>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-[2rem] border-2 border-dashed border-[#2C2621]/10 p-16 text-center">
          <div className="w-16 h-16 bg-[#065016]/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={28} className="text-[#065016]/30" />
          </div>
          <p
            className={`text-[#2C2621]/40 text-lg mb-2 ${isRtl ? "font-urdu" : "font-serif italic"}`}
          >
            {isRtl
              ? "آپ نے ابھی تک کوئی سوال نہیں پوچھا۔"
              : "No conversations yet."}
          </p>
          <p className="text-[#2C2621]/30 text-sm mb-6">
            {isRtl
              ? "ابھی اپنا پہلا قانونی سوال پوچھیں"
              : "Start by asking your first legal question"}
          </p>
          <button
            onClick={() => setCurrentPage("search")}
            className="px-6 py-3 bg-[#065016] text-white rounded-xl font-bold text-sm hover:bg-[#065016]/90 transition-all inline-flex items-center gap-2"
          >
            <Zap size={16} />
            {isRtl ? "ابھی پوچھیں" : "Ask Now"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => {
            const isUrduItem = item.lang === "ur";
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#2C2621]/10 hover:border-[#A68A56]/30 transition-all overflow-hidden shadow-sm"
              >
                {/* Question Row */}
                <div
                  className={`px-6 py-5 flex items-start gap-4 cursor-pointer ${isRtl ? "flex-row-reverse" : ""}`}
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#065016]/10 flex items-center justify-center text-[#065016] flex-shrink-0 mt-0.5">
                    <User size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`flex items-center gap-2 mb-2 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-[10px] font-black text-[#A68A56] uppercase tracking-[0.2em] bg-[#FDFBF7] px-2.5 py-1 rounded-full border border-[#A68A56]/20">
                        {item.category || "General"}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-[10px] text-[#2C2621]/30 font-medium ${isRtl ? "flex-row-reverse mr-auto" : "ml-auto"}`}
                      >
                        <Calendar size={11} />
                        {new Date(item.created_at).toLocaleDateString(
                          isRtl ? "ur-PK" : "en-US",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </span>
                    </div>
                    <p
                      className={`font-semibold text-[#2C2621] text-base leading-relaxed ${isUrduItem ? "font-urdu text-lg text-right" : ""}`}
                      dir={isUrduItem ? "rtl" : "ltr"}
                    >
                      {item.query}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`text-[#2C2621]/20 flex-shrink-0 mt-1 transition-transform ${isExpanded ? "rotate-90" : ""} ${isRtl ? "rotate-180" : ""}`}
                  />
                </div>

                {/* Answer Row (expanded) */}
                {isExpanded && (
                  <div className="border-t border-[#2C2621]/5">
                    <div
                      className={`px-6 py-5 flex items-start gap-4 bg-[#FDFBF7] ${isRtl ? "flex-row-reverse" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#A68A56]/10 flex items-center justify-center text-[#A68A56] flex-shrink-0 mt-0.5">
                        <BookOpen size={16} />
                      </div>
                      <div
                        className={`flex-1 text-[#2C2621]/75 leading-relaxed text-sm ${isUrduItem ? "font-urdu text-base text-right" : "font-serif"}`}
                        dir={isUrduItem ? "rtl" : "ltr"}
                      >
                        {item.answer}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
