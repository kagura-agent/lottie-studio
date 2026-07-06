"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const t = useTranslations("auth");
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setError("");
  };

  const handleTabSwitch = (newTab: "login" | "signup") => {
    setTab(newTab);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("invalidEmail"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await signup(email, password, displayName || undefined);
      }
      reset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("genericError");
      if (message.includes("already in use")) {
        setError(t("emailTaken"));
      } else if (message.includes("Invalid email or password")) {
        setError(t("wrongCredentials"));
      } else if (message.includes("Too many")) {
        setError(t("rateLimited"));
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl">
        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "login"
                ? "text-white border-b-2 border-violet-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => handleTabSwitch("login")}
          >
            {t("signIn")}
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "signup"
                ? "text-white border-b-2 border-violet-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => handleTabSwitch("signup")}
          >
            {t("signUp")}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* OAuth buttons */}
          <div className="space-y-2">
            <a
              href="/api/auth/github"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {t("continueWithGithub")}
            </a>
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l3.56-2.77z" />  {/* cspell:disable-line */}
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t("continueWithGoogle")}
            </a>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-xs text-zinc-500 uppercase">{t("or")}</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>

          {error && (
            <div className="px-3 py-2 text-sm text-red-300 bg-red-900/30 border border-red-800 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">{t("password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="••••••••"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </div>

          {tab === "signup" && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1">{t("displayName")}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                placeholder={t("displayNamePlaceholder")}
                autoComplete="name"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {submitting
              ? tab === "login"
                ? t("signingIn")
                : t("signingUp")
              : tab === "login"
                ? t("signIn")
                : t("signUp")}
          </button>
        </form>
      </div>
    </div>
  );
}
