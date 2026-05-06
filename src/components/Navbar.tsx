import React, { useState } from "react";
import ReactDOM from "react-dom";

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

  const linkClass = `relative font-black uppercase transition-all duration-300 hover:text-[#A68A56] text-[#065016] py-1 group whitespace-nowrap 
    ${lang === "ur" ? "text-2xl font-urdu tracking-normal" : "text-[14px] tracking-[0.25em]"}`;

  const mobileLinkClass = `w-full text-left font-black uppercase py-5 border-b border-[#065016]/10 
    ${lang === "ur" ? "text-3xl font-urdu text-right text-[#065016]" : "text-lg tracking-widest text-[#065016]"}`;

  const underline =
    "absolute bottom-0 left-0 w-0 h-[2.5px] bg-[#A68A56] transition-all duration-300 group-hover:w-full";

  const closeSidebar = () => setIsSidebarOpen(false);

  // Render the mobile sidebar via portal to escape all stacking contexts
  const sidebar = ReactDOM.createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-[#065016]/30 backdrop-blur-sm transition-all duration-500 z-[200] ${
          isSidebarOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={closeSidebar}
      />

      {/* Sidebar panel */}
      <div
        className={`fixed right-0 top-0 h-full w-[80%] max-w-sm bg-[#FDFBF7] shadow-2xl transition-transform duration-500 ease-out flex flex-col z-[201] ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        dir={lang === "ur" ? "rtl" : "ltr"}
      >
        {/* Sidebar close button (top) */}
        <div className="flex justify-between items-center px-8 pt-6 pb-2">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setCurrentPage("home");
              closeSidebar();
            }}
          >
            <div className="w-8 h-8 bg-[#065016] flex items-center justify-center">
              <span className="text-[#FDFBF7] font-bold text-base">Q</span>
            </div>
            <span className="text-sm font-black text-[#065016] uppercase tracking-tight">
              {t.nav}
            </span>
          </div>
          <button
            onClick={closeSidebar}
            className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 transition-all"
          >
            <div className="w-6 h-0.5 bg-[#065016] rotate-45 translate-y-[3px]" />
            <div className="w-6 h-0.5 bg-[#065016] -rotate-45 -translate-y-[3px]" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex flex-col px-8 pt-6 flex-1">
          <button
            onClick={() => {
              setCurrentPage("search");
              closeSidebar();
            }}
            className={mobileLinkClass}
          >
            {lang === "ur" ? "تلاش" : "Search"}
          </button>
          <button
            onClick={() => {
              setCurrentPage("license");
              closeSidebar();
            }}
            className={mobileLinkClass}
          >
            {t.license}
          </button>
          <button
            onClick={() => {
              setCurrentPage("emergency");
              closeSidebar();
            }}
            className={mobileLinkClass}
          >
            {t.emergency}
          </button>

          <button
            onClick={() => {
              setCurrentPage("document-analysis");
              closeSidebar();
            }}
            className={mobileLinkClass}
          >
            {lang === "ur" ? "دستاویز تجزیہ" : "Analyse Document"}
          </button>
        </nav>

        {/* Bottom actions */}
        <div className="px-8 pb-10 space-y-4">
          {/* Language Toggle */}
          <div className="flex bg-[#065016]/5 rounded-2xl p-1.5 border border-[#065016]/20">
            <button
              onClick={() => {
                setLang("en");
                closeSidebar();
              }}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                lang === "en"
                  ? "bg-[#065016] text-white shadow-md"
                  : "text-[#065016]"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => {
                setLang("ur");
                closeSidebar();
              }}
              className={`flex-1 py-3 rounded-xl font-urdu text-xl font-black transition-all ${
                lang === "ur"
                  ? "bg-[#065016] text-white shadow-md"
                  : "text-[#065016]"
              }`}
            >
              اردو
            </button>
          </div>

          {/* Auth buttons */}
          {user ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setCurrentPage("dashboard");
                  closeSidebar();
                }}
                className="w-full py-4 bg-white text-[#065016] border-2 border-[#065016]/10 rounded-2xl font-black tracking-widest uppercase text-sm"
              >
                {lang === "ur" ? "ڈیش بورڈ" : "Dashboard"}
              </button>
              <button
                onClick={() => {
                  onLogout();
                  closeSidebar();
                }}
                className="w-full py-4 bg-[#065016] text-white rounded-2xl font-black tracking-widest uppercase text-sm"
              >
                {t.logout}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setCurrentPage("auth");
                closeSidebar();
              }}
              className="w-full py-4 bg-[#065016] text-white rounded-2xl font-black tracking-widest uppercase text-sm"
            >
              Access System
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );

  return (
    <div className="sticky top-0 z-50">
      {/* Main Navbar — no sidebar inside here anymore */}
      <nav className="bg-[#FDFBF7]/95 backdrop-blur-2xl border-b border-[#065016]/10">
        <div
          className="max-w-[1440px] mx-auto px-6 lg:px-10 h-20 lg:h-24 flex justify-between items-center"
          dir="ltr"
        >
          {/* Brand */}
          <div
            className="flex items-center gap-4 cursor-pointer group z-50"
            onClick={() => {
              setCurrentPage("home");
              closeSidebar();
            }}
          >
            <div className="w-10 h-10 lg:w-11 lg:h-11 bg-[#065016] flex items-center justify-center rotate-45 group-hover:rotate-0 transition-all duration-500 shadow-[6px_6px_0px_0px_rgba(166,138,86,0.2)]">
              <span className="text-[#FDFBF7] -rotate-45 group-hover:rotate-0 transition-all font-bold text-xl">
                Q
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-black tracking-tighter text-[#065016] hidden sm:block uppercase">
              {t.nav}
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-14 flex-[2] justify-center">
            <button
              onClick={() => setCurrentPage("search")}
              className={linkClass}
            >
              {lang === "ur" ? "تلاش" : "Search"} <div className={underline} />
            </button>
            <button
              onClick={() => setCurrentPage("license")}
              className={linkClass}
            >
              {t.license} <div className={underline} />
            </button>
            <button
              onClick={() => setCurrentPage("emergency")}
              className={linkClass}
            >
              {t.emergency} <div className={underline} />
            </button>

            <button
              onClick={() => setCurrentPage("document-analysis")}
              className={linkClass}
            >
              {lang === "ur" ? "دستاویز" : "Analyse Doc"}{" "}
              <div className={underline} />
            </button>
          </div>

          {/* Auth & Language */}
          <div className="flex items-center gap-4 lg:gap-8 flex-1 justify-end">
            {/* Language toggle */}
            <div className="hidden sm:flex items-center bg-[#065016]/10 rounded-full p-1 border border-[#065016]/30">
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${
                  lang === "en"
                    ? "bg-[#065016] text-white shadow-sm"
                    : "text-[#065016]/60"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ur")}
                className={`px-4 py-1 text-lg font-black rounded-full transition-all font-urdu ${
                  lang === "ur"
                    ? "bg-[#065016] text-white shadow-sm"
                    : "text-[#065016]/60"
                }`}
              >
                اردو
              </button>
            </div>

            {/* Desktop auth */}
            {user ? (
              <div className="hidden lg:flex items-center gap-4 animate-in">
                <button
                  onClick={() => setCurrentPage("dashboard")}
                  className="font-black uppercase text-[#065016] relative group text-xs tracking-widest"
                >
                  {user?.user_metadata?.full_name || "Account"}
                  <div className="absolute -bottom-1 left-0 w-full h-[2px] bg-[#A68A56] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </button>
                <div className="h-4 w-[1px] bg-[#065016]/10" />
                <button
                  onClick={onLogout}
                  className="text-[#065016] font-black uppercase text-[10px] tracking-widest hover:text-[#065016]/70 transition-colors"
                >
                  {t.logout}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentPage("auth")}
                className="hidden lg:block bg-[#065016] text-[#FDFBF7] hover:bg-[#065016]/90 transition-all rounded-xl font-black uppercase tracking-widest text-[10px] px-8 py-3.5 shadow-lg active:scale-95"
              >
                Access System
              </button>
            )}

            {/* Hamburger button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-90"
              aria-label="Toggle menu"
            >
              <div
                className={`w-6 h-0.5 bg-[#065016] transition-all duration-300 ${
                  isSidebarOpen ? "rotate-45 translate-y-2" : ""
                }`}
              />
              <div
                className={`w-6 h-0.5 bg-[#065016] transition-all duration-200 ${
                  isSidebarOpen ? "opacity-0" : ""
                }`}
              />
              <div
                className={`w-6 h-0.5 bg-[#065016] transition-all duration-300 ${
                  isSidebarOpen ? "-rotate-45 -translate-y-2" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar rendered via portal to document.body — escapes all stacking contexts */}
      {sidebar}
    </div>
  );
};

export default Navbar;
