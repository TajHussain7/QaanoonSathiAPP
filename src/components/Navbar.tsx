import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronRight, LayoutDashboard, LogOut, User } from "lucide-react";

interface NavbarProps {
  lang: string;
  setLang: (lang: string) => void;
  t: any;
  setCurrentPage: (page: string) => void;
  user: any;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  lang,
  setLang,
  t,
  setCurrentPage,
  user,
  onLogout,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeSidebar = () => setIsSidebarOpen(false);

  const navLinks = [
    { label: lang === "ur" ? "ہوم" : "Home", page: "home" },
    { label: lang === "ur" ? "تلاش" : "Search", page: "search" },
    { label: lang === "ur" ? "دستاویز" : "Analyze Doc", page: "search" },
    { label: t.emergency, page: "emergency" },
    { label: t.license, page: "license" },
  ];

  // ── Mobile sidebar via portal ──────────────────────────────────────────────
  const sidebar = ReactDOM.createPortal(
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-[#065016]/25 backdrop-blur-sm z-[200] cursor-pointer"
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 35 }}
        className="fixed right-0 top-0 h-full w-[82%] max-w-[340px] bg-[#FDFBF7] shadow-2xl flex flex-col z-[201]"
        dir={lang === "ur" ? "rtl" : "ltr"}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#065016]/8">
          <button
            onClick={() => {
              setCurrentPage("home");
              closeSidebar();
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            {/* Q diamond logo — sidebar */}
            <div className="w-8 h-8 bg-[#065016] flex items-center justify-center rotate-45 flex-shrink-0 shadow-[3px_3px_0px_rgba(166,138,86,0.3)]">
              <span className="text-[#FDFBF7] font-bold text-sm -rotate-45 inline-block leading-none">
                Q
              </span>
            </div>
            <span
              className={`font-black text-[#065016] text-base tracking-tight ${lang === "ur" ? "font-urdu" : ""}`}
            >
              {t.nav}
            </span>
          </button>
          <button
            onClick={closeSidebar}
            className="w-9 h-9 flex items-center justify-center text-[#065016]/40 hover:text-[#065016] hover:bg-[#065016]/5 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          {navLinks.map((link) => (
            <button
              key={`${link.page}-${link.label}`}
              onClick={() => {
                setCurrentPage(link.page);
                closeSidebar();
              }}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-xl mb-1 hover:bg-[#065016]/5 transition-colors group cursor-pointer ${
                lang === "ur"
                  ? "flex-row-reverse font-urdu text-xl text-right"
                  : "font-black text-sm tracking-widest uppercase"
              } text-[#065016]`}
            >
              {link.label}
              <ChevronRight
                size={16}
                className={`text-[#065016]/20 group-hover:text-[#065016]/50 transition-colors ${lang === "ur" ? "rotate-180" : ""}`}
              />
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-4 pb-8 space-y-3 border-t border-[#065016]/8 pt-4">
          {/* Language toggle */}
          <div className="flex bg-[#065016]/6 rounded-xl p-1 gap-1">
            {[
              { code: "en", short: "EN" },
              { code: "ur", short: "اردو" },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code);
                  closeSidebar();
                }}
                className={`flex-1 py-2.5 rounded-lg font-black text-sm transition-all cursor-pointer ${
                  l.code === "ur" ? "font-urdu text-lg" : "tracking-widest"
                } ${lang === l.code ? "bg-[#065016] text-white shadow-sm" : "text-[#065016]/60 hover:text-[#065016]"}`}
              >
                {l.short}
              </button>
            ))}
          </div>

          {/* Auth */}
          {user ? (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setCurrentPage("dashboard");
                  closeSidebar();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-[#065016]/10 rounded-xl font-bold text-[#065016] text-sm hover:border-[#065016]/30 transition-colors cursor-pointer"
              >
                <LayoutDashboard size={16} className="text-[#065016]/50" />
                {lang === "ur" ? "ڈیش بورڈ" : "Dashboard"}
              </button>
              <button
                onClick={() => {
                  onLogout();
                  closeSidebar();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#065016] text-white rounded-xl font-bold text-sm cursor-pointer"
              >
                <LogOut size={16} />
                {t.logout}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setCurrentPage("auth");
                closeSidebar();
              }}
              className="w-full py-3.5 bg-[#065016] text-white rounded-xl font-black tracking-widest uppercase text-sm cursor-pointer"
            >
              {lang === "ur" ? "داخل ہوں" : "Access System"}
            </button>
          )}
        </div>
      </motion.div>
    </>,
    document.body,
  );

  return (
    <div className="sticky top-0 z-50">
      <nav
        className={`bg-[#FDFBF7]/96 backdrop-blur-2xl transition-shadow duration-300 ${
          scrolled ? "shadow-[0_2px_24px_rgba(6,80,22,0.08)]" : ""
        }`}
      >
        {/* Main bar */}
        <div
          className="relative max-w-[1440px] mx-auto px-5 lg:px-10 h-[60px] lg:h-[68px] flex items-center justify-between"
          dir="ltr"
        >
          {/* ── Brand / Logo (left) ───────────────────────────────────── */}
          <motion.button
            onClick={() => setCurrentPage("home")}
            className="flex items-center gap-3 flex-shrink-0 group cursor-pointer"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Diamond with "Q" — same rotation animation as original */}
            <div className="w-9 h-9 bg-[#065016] flex items-center justify-center rotate-45 group-hover:rotate-0 transition-all duration-500 shadow-[4px_4px_0px_rgba(166,138,86,0.25)] flex-shrink-0">
              <span className="text-[#FDFBF7] font-bold text-base -rotate-45 group-hover:rotate-0 transition-all duration-500 inline-block leading-none select-none">
                Q
              </span>
            </div>
            <span
              className={`font-black text-[#065016] whitespace-nowrap tracking-tight leading-none hidden sm:block ${
                lang === "ur" ? "font-urdu text-xl" : "text-[17px] uppercase"
              }`}
            >
              {t.nav}
            </span>
          </motion.button>

          {/* ── Desktop Nav (absolutely centred) ─────────────────────── */}
          <motion.div
            className="hidden lg:flex items-center gap-0 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {navLinks.map((link) => (
              <button
                key={`${link.page}-${link.label}`}
                onClick={() => setCurrentPage(link.page)}
                className={`relative px-3.5 py-2 group transition-colors hover:text-[#065016] text-[#065016]/55 cursor-pointer ${
                  lang === "ur"
                    ? "font-urdu text-xl font-black"
                    : "font-black text-[10.5px] tracking-[0.2em] uppercase"
                }`}
              >
                {link.label}
                {/* Animated gold underline on hover */}
                <motion.div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-[#A68A56] rounded-full"
                  initial={{ width: 0 }}
                  whileHover={{ width: "55%" }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            ))}
          </motion.div>

          {/* ── Right: Language + Auth + Hamburger ───────────────────── */}
          <motion.div
            className="flex items-center gap-2 lg:gap-3 flex-shrink-0"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Language pill */}
            <div className="hidden sm:flex items-center gap-0.5 bg-[#065016]/7 rounded-full p-1 border border-[#065016]/12">
              {[
                { code: "en", label: "EN" },
                { code: "ur", label: "اردو" },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`px-3 py-1 rounded-full font-black transition-all cursor-pointer ${
                    l.code === "ur"
                      ? "font-urdu text-[15px]"
                      : "text-[10px] tracking-widest"
                  } ${lang === l.code ? "bg-[#065016] text-white shadow-sm" : "text-[#065016]/50 hover:text-[#065016]"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-[1px] h-5 bg-[#065016]/10" />

            {/* Auth — desktop */}
            {user ? (
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage("dashboard")}
                  className="flex items-center gap-2 px-3 py-2 text-[#065016] rounded-lg hover:bg-[#065016]/5 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 bg-[#065016]/10 rounded-lg flex items-center justify-center">
                    <User size={13} className="text-[#065016]" />
                  </div>
                  <span className="font-black text-[11px] uppercase tracking-widest text-[#065016] max-w-[100px] truncate">
                    {user?.user_metadata?.full_name || "Account"}
                  </span>
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-2 text-[#065016]/50 hover:text-[#065016] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#065016]/5 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  {t.logout}
                </button>
              </div>
            ) : (
              <motion.button
                onClick={() => setCurrentPage("auth")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="hidden lg:flex items-center gap-2 bg-[#065016] text-[#FDFBF7] rounded-xl font-black uppercase tracking-widest text-[10px] px-6 py-2.5 shadow-md hover:bg-[#065016]/90 transition-colors cursor-pointer"
              >
                {lang === "ur" ? "داخل ہوں" : "Access System"}
              </motion.button>
            )}

            {/* Hamburger — mobile/tablet only */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-[#065016]/5 transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              <motion.div
                animate={{
                  rotate: isSidebarOpen ? 45 : 0,
                  y: isSidebarOpen ? 7 : 0,
                }}
                transition={{ duration: 0.25 }}
                className="w-5 h-[1.5px] bg-[#065016] origin-center"
              />
              <motion.div
                animate={{
                  opacity: isSidebarOpen ? 0 : 1,
                  scaleX: isSidebarOpen ? 0 : 1,
                }}
                transition={{ duration: 0.2 }}
                className="w-5 h-[1.5px] bg-[#065016]"
              />
              <motion.div
                animate={{
                  rotate: isSidebarOpen ? -45 : 0,
                  y: isSidebarOpen ? -7 : 0,
                }}
                transition={{ duration: 0.25 }}
                className="w-5 h-[1.5px] bg-[#065016] origin-center"
              />
            </button>
          </motion.div>
        </div>

        {/* Gold accent line */}
        <div className="h-[1.5px] bg-gradient-to-r from-transparent via-[#A68A56]/35 to-transparent" />
      </nav>

      {sidebar}
    </div>
  );
};

export default Navbar;
