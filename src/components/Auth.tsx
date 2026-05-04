import React, { useState } from "react";
import { Eye, EyeOff, Scale, Mail, Lock, User } from "lucide-react";
import { apiCall } from "../services/apiClient";

interface AuthProps {
  t: any;
  lang: string;
  setToken: (token: string | null) => void;
  setUser: (user: any) => void;
  setCurrentPage: (page: string) => void;
}

const Auth: React.FC<AuthProps> = ({
  t,
  lang,
  setToken,
  setUser,
  setCurrentPage,
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin
      ? {
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
        }
      : {
          ...formData,
          email: formData.email.toLowerCase().trim(),
          preferred_lang: lang,
        };

    try {
      const response = await apiCall(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (!data.token && data.message) {
        setError("");
        alert(data.message);
        setIsLogin(true);
        return;
      }

      if (!data.token) {
        throw new Error("Authentication succeeded but no token was provided.");
      }

      localStorage.setItem("qanoonsathi_token", data.token);
      setToken(data.token);
      setUser(data.user);
      setCurrentPage("dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-16 px-6 animate-in">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-[#065016]/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#065016]/10 rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#065016]/5 rounded-tr-full"></div>

        {/* Header */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-14 h-14 bg-[#065016] flex items-center justify-center rounded-2xl mb-4 shadow-lg">
            <Scale size={28} className="text-white" />
          </div>
          <h2
            className={`text-2xl font-black text-[#065016] text-center tracking-tight ${lang === "ur" ? "font-urdu text-3xl" : "font-law"}`}
          >
            {isLogin
              ? lang === "ur"
                ? "لاگ ان"
                : "Sign In"
              : lang === "ur"
                ? "رجسٹر کریں"
                : "Create Account"}
          </h2>
          <p className="text-[#065016]/50 text-xs mt-1 font-medium tracking-wide">
            {isLogin
              ? lang === "ur"
                ? "اپنے اکاؤنٹ میں داخل ہوں"
                : "Access your legal assistant"
              : lang === "ur"
                ? "نیا اکاؤنٹ بنائیں"
                : "Join QaanoonSathi today"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm text-center border border-red-200">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 relative z-10"
          dir={lang === "ur" ? "rtl" : "ltr"}
        >
          {!isLogin && (
            <div>
              <label
                className={`block text-[#065016]/60 text-xs font-semibold mb-2 ${lang === "ur" ? "font-urdu text-sm" : "uppercase tracking-widest"}`}
              >
                {lang === "ur" ? "پورا نام" : "Full Name"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#065016]/30">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  spellCheck="false"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="w-full bg-[#FDFBF7] pl-10 pr-4 py-3.5 rounded-xl border border-[#065016]/10 focus:border-[#065016]/50 focus:ring-2 focus:ring-[#065016]/10 outline-none transition-all text-[#2C2621]"
                  placeholder={
                    lang === "ur" ? "اپنا نام درج کریں" : "Enter your full name"
                  }
                />
              </div>
            </div>
          )}

          <div>
            <label
              className={`block text-[#065016]/60 text-xs font-semibold mb-2 ${lang === "ur" ? "font-urdu text-sm" : "uppercase tracking-widest"}`}
            >
              {lang === "ur" ? "ای میل" : "Email Address"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#065016]/30">
                <Mail size={16} />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                spellCheck="false"
                inputMode="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full bg-[#FDFBF7] pl-10 pr-4 py-3.5 rounded-xl border border-[#065016]/10 focus:border-[#065016]/50 focus:ring-2 focus:ring-[#065016]/10 outline-none transition-all text-[#2C2621]"
                dir="ltr"
                placeholder="email@example.pk"
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-[#065016]/60 text-xs font-semibold mb-2 ${lang === "ur" ? "font-urdu text-sm" : "uppercase tracking-widest"}`}
            >
              {lang === "ur" ? "پاس ورڈ" : "Password"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#065016]/30">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full bg-[#FDFBF7] pl-10 pr-12 py-3.5 rounded-xl border border-[#065016]/10 focus:border-[#065016]/50 focus:ring-2 focus:ring-[#065016]/10 outline-none transition-all text-[#2C2621]"
                dir="ltr"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#065016]/40 hover:text-[#065016] transition-colors p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#065016] text-white rounded-xl font-bold tracking-wide hover:bg-[#065016]/90 transition-all cursor-pointer active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading
              ? lang === "ur"
                ? "براہ کرم انتظار کریں..."
                : "Please wait..."
              : isLogin
                ? lang === "ur"
                  ? "لاگ ان کریں"
                  : "Sign In"
                : lang === "ur"
                  ? "اکاؤنٹ بنائیں"
                  : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center relative z-10">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setFormData({ full_name: "", email: "", password: "" });
            }}
            className={`text-[#065016] font-semibold text-sm hover:text-[#065016]/70 transition-colors cursor-pointer ${lang === "ur" ? "font-urdu" : ""}`}
          >
            {isLogin
              ? lang === "ur"
                ? "نیا اکاؤنٹ بنائیں؟ رجسٹر کریں"
                : "Don't have an account? Register"
              : lang === "ur"
                ? "پہلے سے اکاؤنٹ ہے؟ لاگ ان کریں"
                : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
