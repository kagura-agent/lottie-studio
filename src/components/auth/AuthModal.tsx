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
