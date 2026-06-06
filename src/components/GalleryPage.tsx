"use client";

import { useEffect, useState } from "react";
import AnimationCard from "@/components/AnimationCard";
import TemplateCard from "@/components/TemplateCard";
import Link from "next/link";

interface Animation {
  id: string;
  name: string;
  frame_count: number | null;
  duration_seconds: number | null;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  file: string;
}

export default function GalleryPage() {
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/animations")
        .then((res) => res.json())
        .catch(() => []),
      fetch("/templates/index.json")
        .then((res) => res.json())
        .catch(() => []),
    ])
      .then(([animData, templateData]) => {
        setAnimations(animData);
        setTemplates(templateData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">
              {animations.length > 0 ? "Animations" : "Get Started"}
            </h1>
            {animations.length > 0 && (
              <p className="text-sm text-zinc-400 mt-1">
                {animations.length} animation
                {animations.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link
            href="/editor/new"
            className="px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Create Animation
          </Link>
        </div>

        {/* Templates Section */}
        {templates.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                <h2 className="text-lg font-medium text-zinc-200">
                  Templates
                </h2>
              </div>
              <span className="text-xs text-zinc-500">
                Pick a starter and remix it with chat
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  id={tmpl.id}
                  name={tmpl.name}
                  description={tmpl.description}
                  category={tmpl.category}
                  file={tmpl.file}
                />
              ))}
            </div>
          </div>
        )}

        {/* User Animations Section */}
        {animations.length > 0 && (
          <>
            {templates.length > 0 && (
              <div className="border-t border-zinc-800 my-8" />
            )}
            <div className="mb-4">
              <h2 className="text-lg font-medium text-zinc-200">
                Your Animations
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {animations.map((anim) => (
                <AnimationCard
                  key={anim.id}
                  id={anim.id}
                  name={anim.name}
                  frameCount={anim.frame_count}
                  durationSeconds={anim.duration_seconds}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty state for no user animations (templates still visible above) */}
        {animations.length === 0 && templates.length > 0 && (
          <>
            <div className="border-t border-zinc-800 my-8" />
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">
                Pick a template above to get started, or{" "}
                <Link
                  href="/editor/new"
                  className="text-zinc-300 underline hover:text-white transition-colors"
                >
                  create from scratch
                </Link>
              </p>
            </div>
          </>
        )}

        {/* Fallback if everything is empty */}
        {animations.length === 0 && templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100">
                No animations yet
              </h2>
              <p className="text-sm text-zinc-400 max-w-sm">
                Get started by creating your first Lottie animation in the
                editor.
              </p>
            </div>
            <Link
              href="/editor/new"
              className="px-5 py-2.5 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              Create Animation
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
