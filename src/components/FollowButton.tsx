"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface FollowButtonProps {
  userId: string;
  className?: string;
}

export default function FollowButton({ userId, className = "" }: FollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${userId}/follow`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setFollowing(data.following);
          setFollowerCount(data.followerCount);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [userId]);

  if (!loaded || (user && user.id === userId)) {
    return null;
  }

  const handleClick = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowerCount((c) => (wasFollowing ? Math.max(0, c - 1) : c + 1));

    try {
      const res = await fetch(`/api/users/${userId}/follow`, { method: "POST" });
      if (!res.ok) {
        setFollowing(wasFollowing);
        setFollowerCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)));
        return;
      }
      const data = await res.json();
      setFollowing(data.following);
      setFollowerCount(data.followerCount);
    } catch {
      setFollowing(wasFollowing);
      setFollowerCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)));
    }
  };

  const label = following
    ? hovering
      ? "Unfollow"
      : "Following"
    : "Follow";

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
        following
          ? hovering
            ? "bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-900/50"
            : "bg-zinc-800 text-zinc-300 border border-zinc-700"
          : "bg-violet-600 text-white hover:bg-violet-500"
      } ${className}`}
    >
      {label}
    </button>
  );
}
