import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, X, ChevronDown, CheckSquare, Loader2 } from "lucide-react";
import { apiCall } from "../services/apiClient";

interface Props {
  lang: string;
  token?: string | null;
  onClose: () => void;
}

const DOCUMENT_TYPES_EN = [
  "Rent Agreement (Residential)",
  "Rent Agreement (Commercial)",
  "Nikah Nama (Marriage Contract)",
  "Business Partnership Deed",
  "FIR Filing Guide",
  "Property Transfer / Sale Deed",
  "Divorce Proceedings (Khula)",
  "Divorce Proceedings (Talaq)",
  "Labour / Employment Complaint",
  "Consumer Rights Complaint",
  "Bail Application",
  "Power of Attorney (Wakalatnama)",
  "Will (Wasiyat)",
];

const DOCUMENT_TYPES_UR = [
  "کرایہ نامہ (رہائشی)",
  "کرایہ نامہ (تجارتی)",
  "نکاح نامہ",
  "تجارتی شراکت داری کا معاہدہ",
  "ایف آئی آر دائر کرنے کا طریقہ",
  "جائیداد کی منتقلی / فروخت نامہ",
  "طلاق کا طریقہ کار (خلع)",
  "طلاق کا طریقہ کار (طلاق)",
  "مزدور / ملازمت کی شکایت",
  "صارف کی شکایت",
  "ضمانت کی درخواست",
  "وکالت نامہ",
  "وصیت",
];

const ChecklistModal: React.FC<Props> = ({ lang, token, onClose }) => {
  const [selectedType, setSelectedType] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);

  const isUrdu = lang === "ur";
  const docTypes = isUrdu ? DOCUMENT_TYPES_UR : DOCUMENT_TYPES_EN;

  const handleGenerate = async () => {
    if (!selectedType) return;
    setLoading(true);
    setError("");
    setItems([]);
    setGenerated(false);

    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await apiCall("/api/checklist", {
        method: "POST",
        headers,
        body: JSON.stringify({ documentType: selectedType, lang }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setItems(data.items || []);
      setGenerated(true);
    } catch (err: any) {
      setError(
        isUrdu
          ? "چیک لسٹ بنانے میں خرابی۔ دوبارہ کوشش کریں۔"
          : "Failed to generate checklist. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyChecklist = () => {
    const text = `${selectedType}\n\n${items.map((item, i) => `${i + 1}. ${item}`).join("\n")}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative bg-white rounded-[2rem] shadow-2xl border border-[#065016]/10 w-full max-w-lg overflow-hidden"
          dir={isUrdu ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-[#065016]/10 bg-[#065016]/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#065016] flex items-center justify-center text-white">
                <FileText size={18} />
              </div>
              <div>
                <h3
                  className={`font-black text-[#065016] text-base ${isUrdu ? "font-urdu" : ""}`}
                >
                  {isUrdu
                    ? "قانونی دستاویز چیک لسٹ"
                    : "Legal Document Checklist"}
                </h3>
                <p className="text-[10px] text-[#065016]/50 font-medium mt-0.5">
                  {isUrdu
                    ? "پاکستانی قانون کے مطابق"
                    : "Based on Pakistani Law"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#065016]/30 hover:text-[#065016] hover:bg-[#065016]/5 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-7 py-6 max-h-[70vh] overflow-y-auto">
            {/* Document type selector */}
            <div className="mb-5">
              <label
                className={`block text-[11px] font-black text-[#065016]/70 uppercase tracking-widest mb-2 ${isUrdu ? "text-right" : ""}`}
              >
                {isUrdu ? "دستاویز کی قسم منتخب کریں" : "Select Document Type"}
              </label>
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setItems([]);
                    setGenerated(false);
                    setError("");
                  }}
                  className={`w-full appearance-none bg-[#FDFBF7] border border-[#065016]/20 rounded-xl px-4 py-3 text-[#065016] font-semibold text-sm focus:outline-none focus:border-[#065016]/50 transition-colors ${isUrdu ? "text-right font-urdu" : ""}`}
                  dir={isUrdu ? "rtl" : "ltr"}
                >
                  <option value="">
                    {isUrdu
                      ? "— قسم منتخب کریں —"
                      : "— Choose a document type —"}
                  </option>
                  {docTypes.map((type, i) => (
                    <option key={i} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className={`absolute top-1/2 -translate-y-1/2 text-[#065016]/40 pointer-events-none ${isUrdu ? "left-4" : "right-4"}`}
                />
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedType || loading}
              className="w-full py-3 bg-[#065016] text-white font-bold text-sm rounded-xl hover:bg-[#065016]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isUrdu ? "بنایا جا رہا ہے..." : "Generating..."}
                </>
              ) : (
                <>
                  <CheckSquare size={16} />
                  {isUrdu ? "چیک لسٹ بنائیں" : "Generate Checklist"}
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <p
                className={`mt-3 text-sm text-red-500 font-medium ${isUrdu ? "text-right" : ""}`}
              >
                {error}
              </p>
            )}

            {/* Checklist items */}
            <AnimatePresence>
              {generated && items.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className={`text-[11px] font-black text-[#065016]/70 uppercase tracking-widest ${isUrdu ? "text-right" : ""}`}
                    >
                      {isUrdu ? "مراحل / ضروریات" : "Steps & Requirements"}
                    </p>
                    <button
                      onClick={handleCopyChecklist}
                      className="text-[11px] font-bold text-[#065016]/50 hover:text-[#065016] transition-colors"
                    >
                      {isUrdu ? "کاپی کریں" : "Copy All"}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: isUrdu ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex gap-3 p-3.5 bg-[#FDFBF7] border border-[#065016]/8 rounded-xl ${isUrdu ? "flex-row-reverse" : ""}`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-[#065016]/10 flex items-center justify-center text-[#065016] font-black text-[11px] flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p
                          className={`text-sm text-[#2C2621]/80 leading-relaxed flex-1 ${isUrdu ? "font-urdu text-base text-right" : ""}`}
                          dir={isUrdu ? "rtl" : "ltr"}
                        >
                          {item}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-5 p-4 bg-[#A68A56]/8 border border-[#A68A56]/20 rounded-xl">
                    <p
                      className={`text-[11px] text-[#A68A56] font-semibold italic leading-relaxed ${isUrdu ? "text-right font-urdu" : ""}`}
                    >
                      ⚖️{" "}
                      {isUrdu
                        ? "یہ چیک لسٹ عام رہنمائی کے لیے ہے۔ اہم معاملات کے لیے کسی مستند وکیل سے رجوع کریں۔"
                        : "This checklist is for general guidance only. Consult a qualified lawyer for important matters."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChecklistModal;
