"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "./AuthModal";

export default function UserMenu() {
  const t = useTranslations("auth");
  const { user, loading, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-zinc-700 animate-pulse" />;
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
        >
          {t("signIn")}
        </button>
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  const initials = (user.display_name || user.email)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown((v) => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        )}
        <span className="text-sm text-zinc-300 hidden sm:inline max-w-[120px] truncate">
          {user.display_name || user.email}
        </span>
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-50">
          <div className="px-3 py-2 border-b border-zinc-700">
            <p className="text-sm font-medium text-white truncate">
              {user.display_name || user.email}
            </p>
            {user.display_name && (
              <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            )}
          </div>
          <Link
            href="/profile"
            className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            onClick={() => setShowDropdown(false)}
          >
            {t("myAnimations")}
          </Link>
          <Link
            href="/feed"
            className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            onClick={() => setShowDropdown(false)}
          >
            Feed
          </Link>
          <Link
            href="/profile#settings"
            className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            onClick={() => setShowDropdown(false)}
          >
            {t("settings")}
          </Link>
          <button
            onClick={async () => {
              setShowDropdown(false);
              await logout();
            }}
            className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
