import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, X } from "lucide-react";

const LEGAL_GLOSSARY: Record<string, { en: string; ur: string }> = {
  Nikah: {
    en: "Islamic marriage contract — a formal, legally binding agreement between two parties under Pakistani family law.",
    ur: "نکاح — اسلامی شادی کا عقد، پاکستانی عائلی قانون کے تحت دو فریقوں کے درمیان ایک باضابطہ قانونی معاہدہ۔",
  },
  Mehr: {
    en: "Obligatory gift/payment from husband to wife upon marriage — a fundamental right under Muslim Personal Law.",
    ur: "مہر — نکاح پر شوہر کی طرف سے بیوی کو لازمی تحفہ/ادائیگی — مسلم پرسنل لاء کے تحت بنیادی حق۔",
  },
  Talaq: {
    en: "Islamic divorce — the husband's pronouncement ending the marriage. Three forms exist under Pakistani law.",
    ur: "طلاق — اسلامی طریقہ طلاق — شوہر کا اعلان جو نکاح ختم کرتا ہے۔ پاکستانی قانون کے تحت تین اقسام ہیں۔",
  },
  Khula: {
    en: "Woman-initiated divorce in Islamic law. The wife returns the Mehr and applies to court for dissolution.",
    ur: "خلع — عورت کی طرف سے شروع کردہ طلاق۔ بیوی مہر واپس کرتی ہے اور عدالت میں درخواست دیتی ہے۔",
  },
  Faraid: {
    en: "Islamic inheritance law — the fixed shares of inheritance for specific heirs defined in the Quran.",
    ur: "فرائض — اسلامی وراثت قانون — قرآن میں متعین وارثوں کے لیے وراثت کے مقررہ حصے۔",
  },
  Hiba: {
    en: "Gift deed — a voluntary, unconditional transfer of property without any consideration (payment) in return.",
    ur: "ہبہ — تحفہ — جائیداد کی رضاکارانہ، غیر مشروط منتقلی بغیر کسی معاوضے کے۔",
  },
  Waqf: {
    en: "Islamic endowment — property permanently donated for religious, educational, or charitable purposes.",
    ur: "وقف — اسلامی وقف — جائیداد جو مذہبی، تعلیمی یا خیراتی مقاصد کے لیے مستقل طور پر وقف کی جائے۔",
  },
  FIR: {
    en: "First Information Report — the first formal complaint registered at a police station to initiate criminal proceedings.",
    ur: "ایف آئی آر — پولیس اسٹیشن میں فوجداری کارروائی شروع کرنے کے لیے درج کی جانے والی پہلی باضابطہ شکایت۔",
  },
  Qisas: {
    en: "Retaliation in kind under Islamic criminal law — the victim's family's right to equal punishment or forgiveness.",
    ur: "قصاص — اسلامی فوجداری قانون کے تحت برابر سزا — مظلوم کے ورثاء کا حق جوابی سزا یا معافی۔",
  },
  Diyat: {
    en: "Blood money — financial compensation paid to the victim's family for injury or death under Islamic law.",
    ur: "دیت — خون بہا — اسلامی قانون کے تحت چوٹ یا موت کے لیے مقتول کے ورثاء کو مالی معاوضہ۔",
  },
  Hadd: {
    en: "Fixed criminal punishments prescribed by Islamic law (Quran/Sunnah) for specific serious offences.",
    ur: "حد — مقررہ فوجداری سزائیں جو اسلامی قانون (قرآن/سنت) نے مخصوص سنگین جرائم کے لیے تجویز کی ہیں۔",
  },
  Tazir: {
    en: "Discretionary punishment by a judge for offences not covered by Hadd. Flexible under Pakistani Penal Code.",
    ur: "تعزیر — جج کی صوابدیدی سزا ان جرائم کے لیے جو حد کے دائرے میں نہیں آتے۔",
  },
  PECA: {
    en: "Prevention of Electronic Crimes Act 2016 — Pakistan's cybercrime law covering online harassment, hacking, and digital fraud.",
    ur: "پیکا — الیکٹرانک جرائم کی روک تھام کا قانون 2016 — آن لائن ہراسانی، ہیکنگ اور ڈیجیٹل دھوکہ دہی کا قانون۔",
  },
  CrPC: {
    en: "Code of Criminal Procedure 1898 — governs how criminal cases are investigated, prosecuted, and tried in Pakistan.",
    ur: "ضابطہ فوجداری 1898 — پاکستان میں فوجداری مقدمات کی تفتیش اور مقدمہ چلانے کا طریقہ کار۔",
  },
  CPC: {
    en: "Code of Civil Procedure 1908 — governs civil court proceedings, filing suits, appeals, and enforcement of decrees in Pakistan.",
    ur: "ضابطہ دیوانی 1908 — پاکستان میں دیوانی عدالتی کارروائی، مقدمہ دائر کرنے، اپیل اور ڈگری کے نفاذ کا طریقہ۔",
  },
  Bail: {
    en: "Temporary release of an accused person from custody pending trial. Can be pre-arrest (anticipatory) or post-arrest.",
    ur: "ضمانت — مقدمے کی سماعت کے دوران ملزم کی عارضی رہائی۔ پیشگی گرفتاری سے پہلے یا بعد ہو سکتی ہے۔",
  },
  Writ: {
    en: "A formal order issued by a High Court or Supreme Court directing a party to act or stop acting in a certain way.",
    ur: "رٹ — ہائی کورٹ یا سپریم کورٹ کا باضابطہ حکم جو کسی فریق کو کچھ کرنے یا روکنے کی ہدایت دیتا ہے۔",
  },
  "Habeas Corpus": {
    en: "A writ requiring that a detained person be brought before the court to determine if their detention is lawful.",
    ur: "ہیبیس کارپس — عدالتی حکم کہ نظربند شخص کو عدالت میں پیش کیا جائے تاکہ نظربندی کا جائزہ لیا جا سکے۔",
  },
  "Stay Order": {
    en: "A court order temporarily stopping a legal proceeding, judgment, or action until the matter is fully decided.",
    ur: "اسٹے آرڈر — عدالتی حکم جو کسی قانونی کارروائی، فیصلے یا عمل کو عارضی طور پر روکتا ہے۔",
  },
  "Specific Performance": {
    en: "Court order compelling a party to fulfill their contractual obligations — common in property disputes in Pakistan.",
    ur: "مخصوص کارکردگی — عدالتی حکم جو کسی فریق کو معاہدے کی شرائط پوری کرنے پر مجبور کرتا ہے۔",
  },
};

interface Props {
  text: string;
  lang: string;
}

const LegalGlossaryBadges: React.FC<Props> = ({ text, lang }) => {
  const [activeTermKey, setActiveTermKey] = useState<string | null>(null);

  const foundTerms = Object.keys(LEGAL_GLOSSARY).filter((term) =>
    new RegExp(`\\b${term}\\b`, "i").test(text),
  );

  if (foundTerms.length === 0) return null;

  const activeTerm = activeTermKey ? LEGAL_GLOSSARY[activeTermKey] : null;

  return (
    <div className="px-8 pb-5">
      <div className="border-t border-[#065016]/5 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={13} className="text-[#065016]/60" />
          <p className="text-[10px] font-black text-[#065016]/70 uppercase tracking-[0.3em]">
            {lang === "ur" ? "قانونی اصطلاحات" : "Legal Terms in This Answer"}
          </p>
        </div>

        <div
          className={`flex flex-wrap gap-2 ${lang === "ur" ? "justify-end" : ""}`}
        >
          {foundTerms.map((term) => (
            <button
              key={term}
              onClick={() =>
                setActiveTermKey(activeTermKey === term ? null : term)
              }
              className={`px-3 py-1.5 text-[11px] font-bold rounded-full border transition-all ${
                activeTermKey === term
                  ? "bg-[#065016] text-white border-[#065016]"
                  : "bg-[#A68A56]/8 text-[#A68A56] border-[#A68A56]/25 hover:bg-[#A68A56]/15"
              }`}
            >
              {term}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {activeTermKey && activeTerm && (
            <motion.div
              key={activeTermKey}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="bg-[#A68A56]/5 border border-[#A68A56]/20 rounded-xl p-4 relative">
                <button
                  onClick={() => setActiveTermKey(null)}
                  className="absolute top-3 right-3 p-1 text-[#065016]/30 hover:text-[#065016] transition-colors"
                >
                  <X size={14} />
                </button>
                <p className="text-[11px] font-black text-[#A68A56] uppercase tracking-widest mb-1.5">
                  {activeTermKey}
                </p>
                <p
                  className={`text-sm text-[#2C2621]/75 leading-relaxed pr-6 ${
                    lang === "ur" ? "font-urdu text-base text-right" : ""
                  }`}
                  dir={lang === "ur" ? "rtl" : "ltr"}
                >
                  {lang === "ur" ? activeTerm.ur : activeTerm.en}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LegalGlossaryBadges;
