"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { loadAnimation, type AnimationItem } from "@/lib/lottie";
import { useAuth } from "@/contexts/AuthContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserMenu from "@/components/auth/UserMenu";

interface Animation {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  frame_count: number | null;
  duration_seconds: number | null;
}

interface AnalyticsOverview {
  totalViews: number;
  totalAnimations: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
}

interface TopAnimation {
  id: string;
  name: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
}

interface ViewDataPoint {
  date: string;
  count: number;
}

interface FavoriteAnimation {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  frame_count: number | null;
  duration_seconds: number | null;
  like_count: number;
  view_count: number;
  liked_at: string;
}

interface ProfileData {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    follower_count: number;
    following_count: number;
  };
  animationCount: number;
  providers: string[];
}

type SortOption = "recent" | "oldest" | "name";

function ProfileAnimationCard({
  id,
  name,
  frameCount,
  durationSeconds,
}: {
  id: string;
  name: string;
  frameCount: number | null;
  durationSeconds: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/animations/${id}`);
        const json = await res.json();
        if (cancelled || !containerRef.current || !json.data) return;
        try {
          animRef.current = await loadAnimation({
            container: containerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: json.data,
          });
          setLoaded(true);
        } catch {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [id]);

  const duration =
    durationSeconds != null ? `${durationSeconds.toFixed(1)}s` : "—";
  const frames =
    frameCount != null
      ? t("animationCard.frames", { count: frameCount })
      : "—";

  return (
    <div
      onClick={() => router.push(`/editor/${id}`)}
      className="group block rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition-all hover:border-zinc-600 hover:shadow-lg hover:shadow-zinc-900/50 cursor-pointer"
    >
      <div
        className="relative aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        <div ref={containerRef} className="w-full h-full p-4" />
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            {t("common.failedToLoad")}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-zinc-100 truncate group-hover:text-white">
          {name}
        </h3>
        <div className="mt-1 flex gap-3 text-xs text-zinc-500">
          <span>{duration}</span>
          <span>{frames}</span>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const t = useTranslations("profile");
  const tAuth = useTranslations("auth");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<SortOption>("recent");
  const [loadingAnimations, setLoadingAnimations] = useState(true);

  // Favorites tab
  const [activeTab, setActiveTab] = useState<"animations" | "favorites" | "analytics">("animations");
  const [favoriteAnimations, setFavoriteAnimations] = useState<FavoriteAnimation[]>([]);
  const [favoritesTotal, setFavoritesTotal] = useState(0);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [favoritesTotalPages, setFavoritesTotalPages] = useState(1);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // Analytics tab
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [topAnimations, setTopAnimations] = useState<TopAnimation[]>([]);
  const [viewsData, setViewsData] = useState<ViewDataPoint[]>([]);
  const [viewsPeriod, setViewsPeriod] = useState<"7d" | "30d">("7d");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Display name editing
  const [editingName, setEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingAnimations(true);
      try {
        const res = await fetch(`/api/user/animations?page=${page}&limit=24&sort=${sort}`);
        const data = res.ok ? await res.json() : null;
        if (!cancelled && data) {
          setAnimations(data.animations);
          setTotalPages(data.totalPages);
        }
      } catch {}
      if (!cancelled) setLoadingAnimations(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user, page, sort]);

  useEffect(() => {
    if (!user || activeTab !== "favorites") return;
    let cancelled = false;
    const load = async () => {
      setLoadingFavorites(true);
      try {
        const res = await fetch(`/api/users/${user.id}/favorites?page=${favoritesPage}&limit=24`);
        const data = res.ok ? await res.json() : null;
        if (!cancelled && data) {
          setFavoriteAnimations(data.animations);
          setFavoritesTotal(data.total);
          setFavoritesTotalPages(data.totalPages);
        }
      } catch {}
      if (!cancelled) setLoadingFavorites(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user, activeTab, favoritesPage]);

  useEffect(() => {
    if (!user || activeTab !== "analytics") return;
    let cancelled = false;
    const load = async () => {
      setLoadingAnalytics(true);
      try {
        const [overviewRes, animsRes, viewsRes] = await Promise.all([
          fetch("/api/analytics/overview"),
          fetch("/api/analytics/animations?limit=10"),
          fetch(`/api/analytics/views?period=${viewsPeriod}`),
        ]);
        if (cancelled) return;
        if (overviewRes.ok) setAnalyticsOverview(await overviewRes.json());
        if (animsRes.ok) {
          const data = await animsRes.json();
          setTopAnimations(data.animations);
        }
        if (viewsRes.ok) {
          const data = await viewsRes.json();
          setViewsData(data.views);
        }
      } catch {}
      if (!cancelled) setLoadingAnalytics(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user, activeTab, viewsPeriod]);

  useEffect(() => {
    if (window.location.hash === "#settings" && settingsRef.current) {
      settingsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [profile]);

  const handleSaveDisplayName = async () => {
    setSavingName(true);
    setNameMessage("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayNameInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev) =>
          prev ? { ...prev, user: data.user } : prev
        );
        await refreshUser();
        setEditingName(false);
        setNameMessage(t("displayNameUpdated"));
        setTimeout(() => setNameMessage(""), 3000);
      } else {
        setNameMessage(data.error || "Failed to update");
      }
    } catch {
      setNameMessage("Failed to update");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordsDoNotMatch"));
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage(t("passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordMessage(""), 3000);
      } else {
        setPasswordError(data.error || "Failed to update password");
      }
    } catch {
      setPasswordError("Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (profile.user.display_name || profile.user.email)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back to gallery
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Profile header */}
        <div className="flex items-start gap-6 mb-10">
          {profile.user.avatar_url ? (
            <img
              src={profile.user.avatar_url}
              alt=""
              className="w-20 h-20 rounded-full object-cover border-2 border-zinc-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-violet-600 flex items-center justify-center text-2xl font-bold text-white border-2 border-violet-500">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">
              {profile.user.display_name || profile.user.email}
            </h1>
            {profile.user.display_name && (
              <p className="text-sm text-zinc-400 mt-0.5">{profile.user.email}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500">
              <span>
                {t("animationCount", { count: profile.animationCount })}
              </span>
              <span>
                {profile.user.follower_count ?? 0} followers
              </span>
              <span>
                {profile.user.following_count ?? 0} following
              </span>
              <span>
                {t("memberSince", {
                  date: new Date(profile.user.created_at).toLocaleDateString(),
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <section className="mb-12">
          <div className="flex items-center gap-6 border-b border-zinc-800 mb-4">
            <button
              onClick={() => setActiveTab("animations")}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === "animations"
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t("myAnimations")}
              {activeTab === "animations" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                activeTab === "favorites"
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={activeTab === "favorites" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              Favorites
              {favoritesTotal > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full leading-none">
                  {favoritesTotal}
                </span>
              )}
              {activeTab === "favorites" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                activeTab === "analytics"
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Analytics
              {activeTab === "analytics" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500" />
              )}
            </button>
            {activeTab === "animations" && (
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortOption);
                  setPage(1);
                }}
                className="ml-auto mb-3 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
              >
                <option value="recent">{t("sortRecent")}</option>
                <option value="oldest">{t("sortOldest")}</option>
                <option value="name">{t("sortName")}</option>
              </select>
            )}
          </div>

          {activeTab === "animations" && (
            <>
              {loadingAnimations ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
                    >
                      <div className="aspect-square bg-zinc-800 animate-pulse" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : animations.length === 0 ? (
                <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/50">
                  <div className="text-zinc-500 text-4xl mb-4">✨</div>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    {t("noAnimationsYet")}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6">
                    {t("noAnimationsDescription")}
                  </p>
                  <Link
                    href="/editor/new"
                    className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {t("createFirstAnimation")}
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {animations.map((anim) => (
                      <ProfileAnimationCard
                        key={anim.id}
                        id={anim.id}
                        name={anim.name}
                        frameCount={anim.frame_count}
                        durationSeconds={anim.duration_seconds}
                      />
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        ←
                      </button>
                      <span className="text-sm text-zinc-400">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === "favorites" && (
            <>
              {loadingFavorites ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
                    >
                      <div className="aspect-square bg-zinc-800 animate-pulse" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : favoriteAnimations.length === 0 ? (
                <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mx-auto text-zinc-500 mb-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    No favorites yet
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6">
                    Animations you like will appear here.
                  </p>
                  <Link
                    href="/explore"
                    className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Explore animations
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {favoriteAnimations.map((anim) => (
                      <ProfileAnimationCard
                        key={anim.id}
                        id={anim.id}
                        name={anim.name}
                        frameCount={anim.frame_count}
                        durationSeconds={anim.duration_seconds}
                      />
                    ))}
                  </div>

                  {favoritesTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setFavoritesPage((p) => Math.max(1, p - 1))}
                        disabled={favoritesPage === 1}
                        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        ←
                      </button>
                      <span className="text-sm text-zinc-400">
                        {favoritesPage} / {favoritesTotalPages}
                      </span>
                      <button
                        onClick={() => setFavoritesPage((p) => Math.min(favoritesTotalPages, p + 1))}
                        disabled={favoritesPage === favoritesTotalPages}
                        className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === "analytics" && (
            <>
              {loadingAnalytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2 mb-2" />
                        <div className="h-8 bg-zinc-800 rounded animate-pulse w-3/4" />
                      </div>
                    ))}
                  </div>
                  <div className="h-48 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
                </div>
              ) : !analyticsOverview || analyticsOverview.totalAnimations === 0 ? (
                <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mx-auto text-zinc-500 mb-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">
                    No analytics yet
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6">
                    Create and share animations to see analytics here.
                  </p>
                  <Link
                    href="/editor/new"
                    className="inline-flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Create an animation
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overview cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                      { label: "Total Views", value: analyticsOverview.totalViews },
                      { label: "Animations", value: analyticsOverview.totalAnimations },
                      { label: "Likes", value: analyticsOverview.totalLikes },
                      { label: "Comments", value: analyticsOverview.totalComments },
                      { label: "Followers", value: analyticsOverview.totalFollowers },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                      >
                        <div className="text-xs text-zinc-500 mb-1">{card.label}</div>
                        <div className="text-2xl font-bold text-white">
                          {card.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Views chart */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-zinc-300">Views over time</h3>
                      <div className="flex gap-1 bg-zinc-800 rounded-lg p-0.5">
                        {(["7d", "30d"] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => setViewsPeriod(p)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              viewsPeriod === p
                                ? "bg-violet-600 text-white"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            {p === "7d" ? "7 days" : "30 days"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {viewsData.length === 0 ? (
                      <div className="h-32 flex items-center justify-center text-sm text-zinc-500">
                        No view data for this period
                      </div>
                    ) : (
                      <div className="h-40">
                        {(() => {
                          const maxCount = Math.max(...viewsData.map((d) => d.count), 1);
                          return (
                            <div className="flex items-end gap-1 h-full">
                              {viewsData.map((d) => {
                                const pct = (d.count / maxCount) * 100;
                                return (
                                  <div
                                    key={d.date}
                                    className="flex-1 flex flex-col items-center gap-1 min-w-0"
                                  >
                                    <span className="text-[10px] text-zinc-500">
                                      {d.count}
                                    </span>
                                    <div
                                      className="w-full bg-violet-600 rounded-t-sm transition-all"
                                      style={{
                                        height: `${Math.max(pct, 2)}%`,
                                        minHeight: "2px",
                                      }}
                                    />
                                    <span className="text-[10px] text-zinc-600 truncate w-full text-center">
                                      {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Top animations table */}
                  {topAnimations.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-zinc-800">
                        <h3 className="text-sm font-medium text-zinc-300">Top animations</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                              <th className="text-left px-6 py-3 font-medium">#</th>
                              <th className="text-left px-6 py-3 font-medium">Name</th>
                              <th className="text-right px-6 py-3 font-medium">Views</th>
                              <th className="text-right px-6 py-3 font-medium">Likes</th>
                              <th className="text-right px-6 py-3 font-medium">Comments</th>
                              <th className="text-right px-6 py-3 font-medium">Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topAnimations.map((anim, idx) => (
                              <tr
                                key={anim.id}
                                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                                onClick={() => router.push(`/editor/${anim.id}`)}
                              >
                                <td className="px-6 py-3 text-zinc-500">{idx + 1}</td>
                                <td className="px-6 py-3 text-zinc-200 font-medium truncate max-w-[200px]">
                                  {anim.name}
                                </td>
                                <td className="px-6 py-3 text-right text-zinc-300">
                                  {(anim.view_count ?? 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-right text-zinc-300">
                                  {(anim.like_count ?? 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-right text-zinc-300">
                                  {(anim.comment_count ?? 0).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-right text-zinc-500">
                                  {new Date(anim.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* Settings section */}
        <div ref={settingsRef} id="settings">
          <h2 className="text-lg font-semibold text-zinc-100 mb-6">
            {t("settings")}
          </h2>

          <div className="space-y-6">
            {/* Edit display name */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">
                {t("editDisplayName")}
              </h3>
              {editingName ? (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder={t("displayNamePlaceholder")}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                    maxLength={100}
                  />
                  <button
                    onClick={handleSaveDisplayName}
                    disabled={savingName}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {savingName ? t("saving") : t("saveDisplayName")}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {tAuth("signIn") === "Sign In" ? "Cancel" : "取消"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">
                    {profile.user.display_name || profile.user.email}
                  </span>
                  <button
                    onClick={() => {
                      setDisplayNameInput(profile.user.display_name || "");
                      setEditingName(true);
                    }}
                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {t("editDisplayName")}
                  </button>
                </div>
              )}
              {nameMessage && (
                <p className="mt-2 text-sm text-green-400">{nameMessage}</p>
              )}
            </div>

            {/* Change password */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">
                {t("changePassword")}
              </h3>
              <div className="space-y-3 max-w-md">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t("currentPassword")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("newPassword")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("confirmNewPassword")}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={
                    savingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword
                    ? t("updatingPassword")
                    : t("updatePassword")}
                </button>
                {passwordError && (
                  <p className="text-sm text-red-400">{passwordError}</p>
                )}
                {passwordMessage && (
                  <p className="text-sm text-green-400">{passwordMessage}</p>
                )}
              </div>
            </div>

            {/* Linked accounts */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">
                {t("linkedAccounts")}
              </h3>
              <div className="space-y-3">
                {/* GitHub */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span className="text-sm text-zinc-300">GitHub</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      profile.providers.includes("github")
                        ? "bg-green-900/30 text-green-400 border border-green-800"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                    }`}
                  >
                    {profile.providers.includes("github")
                      ? t("connected")
                      : t("notConnected")}
                  </span>
                </div>

                {/* Google */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="text-sm text-zinc-300">Google</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      profile.providers.includes("google")
                        ? "bg-green-900/30 text-green-400 border border-green-800"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                    }`}
                  >
                    {profile.providers.includes("google")
                      ? t("connected")
                      : t("notConnected")}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={async () => {
                await logout();
                router.push("/");
              }}
              className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
