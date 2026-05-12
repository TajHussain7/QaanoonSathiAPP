import React, { useRef } from "react";
import { motion, useInView, type Variants } from "motion/react";
import {
  BookOpen,
  ShieldCheck,
  Landmark,
  SearchCheck,
  ArrowRight,
  Scale,
  MessageSquare,
  FileSearch,
  BadgeCheck,
  Globe,
  Mic,
  FileText,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  ChevronRight,
  Archive,
} from "lucide-react";

interface HeroProps {
  t: any;
  lang: string;
  onCategoryClick: (category: string) => void;
  setCurrentPage?: (page: string) => void;
}

// ── Animation variants ───────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut" },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const stepVariant: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// ── Category cards config ─────────────────────────────────────────────────────
const CATEGORY_ICONS = [
  { icon: BookOpen, color: "bg-[#EAE4D3]", iconColor: "text-[#7A6A3A]" },
  { icon: ShieldCheck, color: "bg-[#DDE4F0]", iconColor: "text-[#3A5A8A]" },
  { icon: Landmark, color: "bg-[#DDE9DD]", iconColor: "text-[#2A6A3A]" },
  { icon: SearchCheck, color: "bg-[#E9DDE9]", iconColor: "text-[#6A3A6A]" },
];

// ── Stats ─────────────────────────────────────────────────────────────────────
const STATS = [
  { icon: Archive, value: "500+", label: "Laws Indexed", labelUr: "قوانین" },
  { icon: Globe, value: "2", label: "Languages", labelUr: "زبانیں" },
  { icon: MapPin, value: "6", label: "Jurisdictions", labelUr: "صوبے" },
  {
    icon: BadgeCheck,
    value: "Free",
    label: "Always Free",
    labelUr: "بالکل مفت",
  },
];

// ── How it works steps ────────────────────────────────────────────────────────
const HOW_STEPS = [
  {
    icon: MessageSquare,
    title: "Ask Your Question",
    titleUr: "سوال پوچھیں",
    desc: "Type in English or Urdu, speak your question, or upload a document or image.",
    descUr:
      "انگریزی یا اردو میں لکھیں، آواز میں سوال کریں، یا دستاویز اپلوڈ کریں۔",
  },
  {
    icon: FileSearch,
    title: "AI Searches Pakistani Law",
    titleUr: "AI قانون تلاش کرتی ہے",
    desc: "Our RAG engine searches 500+ verified Pakistani legal documents in real-time.",
    descUr:
      "ہمارا AI سسٹم 500 سے زیادہ تصدیق شدہ پاکستانی قانونی دستاویزات تلاش کرتا ہے۔",
  },
  {
    icon: BadgeCheck,
    title: "Get Cited Answers",
    titleUr: "حوالہ جات کے ساتھ جواب",
    desc: "Receive accurate, source-referenced answers with links to specific laws and sections.",
    descUr: "مخصوص قوانین اور دفعات کے حوالوں کے ساتھ درست جوابات حاصل کریں۔",
  },
];

// ── Reusable section heading ──────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="flex items-center gap-4 mb-4">
    <div className="h-[1.5px] flex-1 bg-[#065016]/10" />
    <span className="text-[10px] font-black text-[#065016]/50 uppercase tracking-[0.35em] whitespace-nowrap">
      {children}
    </span>
    <div className="h-[1.5px] flex-1 bg-[#065016]/10" />
  </div>
);

// ── Section wrapper with scroll-triggered animation ───────────────────────────
const AnimatedSection: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Hero: React.FC<HeroProps> = ({
  t,
  lang,
  onCategoryClick,
  setCurrentPage,
}) => {
  const isUrdu = lang === "ur";
  const navigate = setCurrentPage || (() => {});

  const cards = [
    { title: t.islamicLaw, desc: t.islamicDesc, ...CATEGORY_ICONS[0] },
    { title: t.harassment, desc: t.harassmentDesc, ...CATEGORY_ICONS[1] },
    { title: t.inheritance, desc: t.inheritanceDesc, ...CATEGORY_ICONS[2] },
    { title: t.verify, desc: t.verifyDesc, ...CATEGORY_ICONS[3] },
  ];

  return (
    <div
      className="bg-[#FDFBF7] overflow-x-hidden"
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {/* ════════════════════════════════════════════════════════════════════
          1. HERO HEADLINE
      ════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-68px)] flex flex-col justify-center overflow-hidden py-16">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <div className="absolute top-[-15%] right-[-8%] w-[55%] h-[55%] bg-[#065016] rounded-full blur-[140px] opacity-[0.035]" />
          <div className="absolute bottom-[-15%] left-[-8%] w-[55%] h-[55%] bg-[#A68A56] rounded-full blur-[140px] opacity-[0.03]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#065016]/6 border border-[#065016]/12 rounded-full mb-8"
          >
            <Scale size={12} className="text-[#A68A56]" />
            <span
              className={`text-[10px] font-black text-[#065016]/70 uppercase tracking-[0.35em] ${isUrdu ? "font-urdu text-sm tracking-normal" : ""}`}
            >
              {isUrdu
                ? "پاکستان کا سرکاری قانونی فریم ورک"
                : "Pakistan Legal Intelligence System"}
            </span>
          </motion.div>

          {/* Main headline */}
          {isUrdu ? (
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-8xl font-black text-[#065016] font-urdu leading-tight mb-6"
            >
              {t.heroTitle}
            </motion.h1>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.h1
                variants={fadeUp}
                className="text-5xl sm:text-7xl md:text-8xl font-black text-[#065016] font-law tracking-tighter leading-[0.92] text-center mb-6"
              >
                KNOW YOUR{" "}
                <span className="animate-color-glow italic">LEGAL</span> RIGHTS
              </motion.h1>
            </motion.div>
          )}

          {/* Sub-headline */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
            className={`max-w-2xl mx-auto text-[#065016]/60 leading-relaxed mb-10 ${
              isUrdu ? "font-urdu text-2xl" : "text-lg font-serif"
            }`}
          >
            {isUrdu
              ? "پاکستانی قانون کے بارے میں فوری، درست اور حوالہ جات سے مزین جوابات — اردو اور انگریزی میں۔"
              : "Instant, accurate, source-cited answers about Pakistani law — powered by AI, available in English and Urdu."}
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
            className={`flex flex-wrap gap-3 justify-center ${isUrdu ? "flex-row-reverse" : ""}`}
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("search")}
              className="flex items-center gap-2.5 bg-[#065016] text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-[#065016]/90 transition-colors"
            >
              <MessageSquare size={16} />
              {isUrdu ? "ابھی سوال پوچھیں" : "Ask a Question"}
              <ArrowRight size={15} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("emergency")}
              className="flex items-center gap-2.5 bg-white text-[#065016] border-2 border-[#065016]/15 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:border-[#065016]/40 transition-colors"
            >
              <Phone size={15} />
              {isUrdu ? "ہنگامی نمبر" : "Emergency Helplines"}
            </motion.button>
          </motion.div>

          {/* Capability pills */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.4 }}
            className={`flex flex-wrap gap-2.5 justify-center mt-8 ${isUrdu ? "flex-row-reverse" : ""}`}
          >
            {[
              { icon: Mic, label: isUrdu ? "آواز سے سوال" : "Voice Input" },
              {
                icon: FileText,
                label: isUrdu ? "دستاویز اسکین" : "Document OCR",
              },
              { icon: Globe, label: isUrdu ? "دو زبانیں" : "Bilingual" },
              { icon: Scale, label: isUrdu ? "حوالہ جات" : "Source-Cited" },
            ].map((pill, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#065016]/10 rounded-full"
              >
                <pill.icon size={11} className="text-[#A68A56]" />
                <span
                  className={`text-[11px] font-bold text-[#065016]/60 ${isUrdu ? "font-urdu text-sm" : ""}`}
                >
                  {pill.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          2. STATS STRIP
      ════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#065016] py-10">
        <AnimatedSection className="max-w-5xl mx-auto px-6">
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-white/10 ${isUrdu ? "flex-row-reverse" : ""}`}
          >
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex flex-col items-center text-center px-6 py-6 gap-2"
              >
                <div className="w-10 h-10 bg-white/8 rounded-xl flex items-center justify-center mb-1">
                  <stat.icon size={18} className="text-[#A68A56]" />
                </div>
                <span className="text-3xl font-black text-white tracking-tight">
                  {stat.value}
                </span>
                <span
                  className={`text-white/50 font-bold uppercase tracking-widest ${isUrdu ? "font-urdu text-base tracking-normal" : "text-[10px]"}`}
                >
                  {isUrdu ? stat.labelUr : stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          3. CATEGORY CARDS
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <SectionLabel>
                {isUrdu ? "قانون کا انتخاب کریں" : "Select Legal Area"}
              </SectionLabel>
              <h2
                className={`font-black text-[#065016] leading-tight ${
                  isUrdu
                    ? "font-urdu text-4xl"
                    : "text-3xl md:text-4xl tracking-tight"
                }`}
              >
                {isUrdu ? "قانونی زمرے" : "Legal Categories"}
              </h2>
              <p
                className={`mt-3 text-[#065016]/50 max-w-xl mx-auto ${isUrdu ? "font-urdu text-lg" : "text-base font-serif"}`}
              >
                {isUrdu
                  ? "اپنی ضرورت کے مطابق قانونی زمرہ منتخب کریں"
                  : "Select a legal area to get targeted, accurate answers from Pakistani law."}
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
            >
              {cards.map((card, index) => (
                <motion.div
                  key={index}
                  variants={cardVariant}
                  whileHover={{ y: -6, transition: { duration: 0.25 } }}
                  onClick={() => onCategoryClick(card.title)}
                  className="group relative bg-white border border-[#065016]/8 rounded-[2rem] p-8 flex flex-col items-center text-center cursor-pointer shadow-sm hover:shadow-xl hover:border-[#065016]/20 transition-all duration-300 overflow-hidden"
                >
                  {/* Hover gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white to-[#FDFBF7] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[2rem]" />

                  <div className="relative z-10 flex flex-col items-center">
                    {/* Icon */}
                    <div
                      className={`w-16 h-16 ${card.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <card.icon size={28} className={card.iconColor} />
                    </div>

                    <h3
                      className={`font-black text-[#065016] mb-3 ${
                        isUrdu ? "font-urdu text-2xl" : "text-lg tracking-tight"
                      }`}
                    >
                      {card.title}
                    </h3>

                    <p
                      className={`text-[#065016]/55 leading-relaxed ${
                        isUrdu
                          ? "font-urdu text-base"
                          : "text-[13px] font-serif"
                      }`}
                    >
                      {card.desc}
                    </p>

                    <div className="mt-6 pt-5 border-t border-[#065016]/8 w-full flex justify-center">
                      <motion.div
                        whileHover={{ x: isUrdu ? -4 : 4 }}
                        className="flex items-center gap-1.5 text-[11px] font-black text-[#065016]/30 group-hover:text-[#A68A56] transition-colors uppercase tracking-widest"
                      >
                        {isUrdu ? "شروع کریں" : "Explore"}
                        <ArrowRight
                          size={13}
                          className={isUrdu ? "rotate-180" : ""}
                        />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          4. HOW IT WORKS
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-white border-t border-[#065016]/5">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <motion.div variants={fadeUp} className="text-center mb-14">
              <SectionLabel>
                {isUrdu ? "طریقہ کار" : "How It Works"}
              </SectionLabel>
              <h2
                className={`font-black text-[#065016] ${isUrdu ? "font-urdu text-4xl" : "text-3xl md:text-4xl tracking-tight"}`}
              >
                {isUrdu ? "تین آسان مراحل" : "Three Simple Steps"}
              </h2>
            </motion.div>

            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 relative`}>
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-10 left-[16.6%] right-[16.6%] h-[1px] bg-gradient-to-r from-transparent via-[#065016]/10 to-transparent" />

              {HOW_STEPS.map((step, i) => (
                <motion.div
                  key={i}
                  variants={stepVariant}
                  transition={{ delay: i * 0.1 }}
                  className="relative flex flex-col items-center text-center p-8 bg-[#FDFBF7] rounded-[2rem] border border-[#065016]/6"
                >
                  {/* Step number */}
                  <div className="w-11 h-11 bg-[#065016] rounded-2xl flex items-center justify-center mb-5 shadow-md relative z-10">
                    <step.icon size={18} className="text-white" />
                  </div>
                  <div className="absolute -top-3 -right-3 w-7 h-7 bg-[#A68A56] rounded-full flex items-center justify-center">
                    <span className="text-white text-[11px] font-black">
                      {i + 1}
                    </span>
                  </div>

                  <h3
                    className={`font-black text-[#065016] mb-3 ${isUrdu ? "font-urdu text-xl" : "text-base tracking-tight"}`}
                  >
                    {isUrdu ? step.titleUr : step.title}
                  </h3>
                  <p
                    className={`text-[#065016]/55 leading-relaxed ${isUrdu ? "font-urdu text-base" : "text-[13px] font-serif"}`}
                  >
                    {isUrdu ? step.descUr : step.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          5. DISCLAIMER
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <motion.div
              variants={fadeUp}
              className="bg-[#A68A56]/6 border border-[#A68A56]/25 rounded-[2rem] p-8 flex gap-5"
              dir={isUrdu ? "rtl" : "ltr"}
            >
              <div className="flex-shrink-0">
                <div className="w-11 h-11 bg-[#A68A56]/15 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={20} className="text-[#A68A56]" />
                </div>
              </div>
              <div>
                <h4
                  className={`font-black text-[#A68A56] mb-2 ${isUrdu ? "font-urdu text-xl" : "text-sm uppercase tracking-widest"}`}
                >
                  {isUrdu ? "اہم قانونی نوٹس" : "Important Legal Disclaimer"}
                </h4>
                <p
                  className={`text-[#2C2621]/65 leading-relaxed ${isUrdu ? "font-urdu text-lg" : "text-sm font-serif"}`}
                >
                  {isUrdu
                    ? "QaanoonSathi پاکستانی قانون کے بارے میں عام معلومات فراہم کرتا ہے۔ یہ پیشہ ورانہ قانونی مشورے کا متبادل نہیں ہے۔ مخصوص قانونی معاملات کے لیے کسی مستند وکیل سے رجوع کریں۔ یہاں دی گئی معلومات کسی مخصوص صورت حال پر لاگو ہونے سے پہلے ماہر قانونی رائے حاصل کریں۔"
                    : "QaanoonSathi provides general legal information based on Pakistani statutes, regulations, and case law. The information is intended for educational purposes only and does not constitute legal advice. For specific legal matters, always consult a qualified and licenced advocate. Laws may have changed since the last update — verify current status with official sources."}
                </p>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          6. FOOTER
      ════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#065016] pt-14 pb-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-10 mb-12 ${isUrdu ? "text-right" : ""}`}
          >
            {/* Col 1: Brand */}
            <div>
              <div
                className={`flex items-center gap-3 mb-4 ${isUrdu ? "flex-row-reverse justify-end" : ""}`}
              >
                <div className="w-9 h-9 bg-white/10 flex items-center justify-center rotate-45 flex-shrink-0">
                  <Scale size={14} className="text-[#A68A56] -rotate-45" />
                </div>
                <span
                  className={`font-black text-white text-lg tracking-tight ${isUrdu ? "font-urdu" : "uppercase"}`}
                >
                  {isUrdu ? "قانون ساتھی" : "QaanoonSathi"}
                </span>
              </div>
              <p
                className={`text-white/45 leading-relaxed mb-5 ${isUrdu ? "font-urdu text-base" : "text-[13px] font-serif"}`}
              >
                {isUrdu
                  ? "پاکستانی شہریوں کے لیے AI سے چلنے والا قانونی مددگار۔ اردو اور انگریزی میں مفت قانونی معلومات۔"
                  : "AI-powered legal intelligence for Pakistani citizens. Accurate, cited answers about Pakistani law in English and Urdu — completely free."}
              </p>
              <div
                className={`flex items-center gap-3 text-white/35 ${isUrdu ? "flex-row-reverse" : ""}`}
              >
                <MapPin size={13} />
                <span
                  className={`text-[11px] font-bold ${isUrdu ? "font-urdu text-sm" : "tracking-widest uppercase"}`}
                >
                  {isUrdu ? "اسلام آباد، پاکستان" : "Islamabad, Pakistan"}
                </span>
              </div>
            </div>

            {/* Col 2: Quick links */}
            <div>
              <h4
                className={`font-black text-white/70 uppercase tracking-widest text-[10px] mb-5 ${isUrdu ? "font-urdu text-sm tracking-normal text-right" : ""}`}
              >
                {isUrdu ? "فوری روابط" : "Quick Links"}
              </h4>
              <div className={`space-y-2 ${isUrdu ? "text-right" : ""}`}>
                {[
                  { label: isUrdu ? "ہوم" : "Home", page: "home" },
                  {
                    label: isUrdu ? "قانونی سوال" : "Ask a Question",
                    page: "search",
                  },
                  {
                    label: isUrdu ? "ہنگامی نمبر" : "Emergency Helplines",
                    page: "emergency",
                  },
                  { label: isUrdu ? "لائسنس" : "License", page: "license" },
                ].map((link) => (
                  <button
                    key={link.page}
                    onClick={() => navigate(link.page)}
                    className={`flex items-center gap-2 text-white/45 hover:text-white transition-colors group ${isUrdu ? "flex-row-reverse w-full justify-end font-urdu text-base" : "text-[13px] font-semibold"}`}
                  >
                    <ChevronRight
                      size={12}
                      className={`text-[#A68A56]/50 group-hover:text-[#A68A56] transition-colors ${isUrdu ? "rotate-180" : ""}`}
                    />
                    {link.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Col 3: About the app */}
            <div>
              <h4
                className={`font-black text-white/70 uppercase tracking-widest text-[10px] mb-5 ${isUrdu ? "font-urdu text-sm tracking-normal text-right" : ""}`}
              >
                {isUrdu ? "ایپ کے بارے میں" : "About the App"}
              </h4>
              <div className="space-y-3">
                {[
                  {
                    icon: Scale,
                    text: isUrdu
                      ? "پاکستانی قوانین پر مبنی"
                      : "Based on Pakistani statutes",
                  },
                  {
                    icon: BadgeCheck,
                    text: isUrdu
                      ? "AI سے تصدیق شدہ جوابات"
                      : "AI-verified answers with sources",
                  },
                  {
                    icon: Globe,
                    text: isUrdu
                      ? "اردو اور انگریزی سپورٹ"
                      : "Urdu & English support",
                  },
                  {
                    icon: Mic,
                    text: isUrdu
                      ? "آواز اور تصویر اپ لوڈ"
                      : "Voice, image & PDF support",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 ${isUrdu ? "flex-row-reverse" : ""}`}
                  >
                    <item.icon
                      size={13}
                      className="text-[#A68A56] flex-shrink-0"
                    />
                    <span
                      className={`text-white/40 ${isUrdu ? "font-urdu text-sm text-right" : "text-[12px] font-medium"}`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className={`border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 ${isUrdu ? "flex-row-reverse text-right" : ""}`}
          >
            <p
              className={`text-white/25 ${isUrdu ? "font-urdu text-sm" : "text-[11px] font-medium tracking-wide"}`}
            >
              {isUrdu
                ? `© ${new Date().getFullYear()} قانون ساتھی۔ تمام حقوق محفوظ ہیں۔`
                : `© ${new Date().getFullYear()} QaanoonSathi. All rights reserved.`}
            </p>
            <p
              className={`text-white/20 ${isUrdu ? "font-urdu text-xs" : "text-[10px] font-medium uppercase tracking-widest"}`}
            >
              {isUrdu
                ? "قانونی مشورہ نہیں — صرف معلومات"
                : "Not Legal Advice · For Informational Use Only"}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Hero;
