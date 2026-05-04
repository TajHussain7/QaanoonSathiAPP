import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, BookOpen, Scale } from "lucide-react";

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: { source: string; section?: string } | null;
  lang: string;
}

const SourceModal: React.FC<SourceModalProps> = ({
  isOpen,
  onClose,
  source,
  lang,
}) => {
  if (!source) return null;

  const isRtl = lang === "ur";

  const handleSearchOnline = () => {
    const q = encodeURIComponent(source.source + " Pakistan Law legislation");
    window.open(`https://www.google.com/search?q=${q}`, "_blank");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#2C2621]/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-[2rem] shadow-2xl z-[101] overflow-hidden border border-[#A68A56]/20"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="bg-[#065016] px-8 py-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <Scale size={20} />
                </div>
                <div>
                  <h3
                    className={`text-lg font-black text-white tracking-tight ${isRtl ? "font-urdu" : ""}`}
                  >
                    {isRtl ? "قانونی ماخذ" : "Legal Source"}
                  </h3>
                  <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest">
                    {isRtl ? "تصدیق شدہ دستاویز" : "Verified Documentation"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="p-8">
              {/* Document Name */}
              <div className="mb-6">
                <span
                  className={`text-[10px] font-black text-[#A68A56] uppercase tracking-[0.3em] block mb-2 ${isRtl ? "text-right" : ""}`}
                >
                  {isRtl ? "دستاویز کا نام" : "Document Name"}
                </span>
                <div className="flex items-start gap-3 p-4 bg-[#FDFBF7] rounded-xl border border-[#065016]/10">
                  <BookOpen
                    size={18}
                    className="text-[#065016]/40 flex-shrink-0 mt-0.5"
                  />
                  <h4
                    className={`text-lg font-bold text-[#2C2621] leading-snug ${isRtl ? "font-urdu text-right" : ""}`}
                  >
                    {source.source}
                  </h4>
                </div>
              </div>

              {/* Relevant Section */}
              {source.section && (
                <div className="mb-8">
                  <span
                    className={`text-[10px] font-black text-[#A68A56] uppercase tracking-[0.3em] block mb-2 ${isRtl ? "text-right" : ""}`}
                  >
                    {isRtl ? "متعلقہ حصہ" : "Relevant Section"}
                  </span>
                  <div className="p-5 bg-[#FDFBF7] rounded-xl border-l-4 border-[#A68A56]">
                    <p
                      className={`text-[#2C2621]/70 leading-relaxed text-sm ${isRtl ? "font-urdu text-lg text-right" : "font-serif italic"}`}
                      dir={isRtl ? "rtl" : "ltr"}
                    >
                      {source.section}
                    </p>
                  </div>
                </div>
              )}

              {/* Search Online Button (only) */}
              <button
                onClick={handleSearchOnline}
                className="w-full py-4 bg-[#065016] text-white rounded-xl font-bold text-sm hover:bg-[#065016]/90 transition-all flex items-center justify-center gap-2.5 shadow-md active:scale-95"
              >
                <ExternalLink size={18} />
                {isRtl ? "آن لائن تلاش کریں" : "Search Online"}
              </button>

              <p className="text-center text-[#2C2621]/30 text-[10px] mt-4 font-medium">
                {isRtl
                  ? "گوگل سرچ کے ذریعے متعلقہ قانونی نتائج دیکھیں"
                  : "Opens relevant Pakistan law results in your browser"}
              </p>
            </div>

            {/* Footer */}
            <div className="bg-[#FDFBF7] px-8 py-4 border-t border-[#2C2621]/5 text-center">
              <p className="text-[9px] text-[#A68A56] font-black uppercase tracking-[0.5em]">
                Authenticity Guaranteed by Qaanoon Sathi Intelligence
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SourceModal;
