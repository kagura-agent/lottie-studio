"use client";

import Link from "next/link";

interface HeroWelcomeProps {
  onDismiss: () => void;
}

export default function HeroWelcome({ onDismiss }: HeroWelcomeProps) {
  return (
    <section className="relative mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        aria-label="Dismiss welcome section"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Background gradient accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative px-8 py-12 sm:px-12 sm:py-16">
        {/* Top section: headline + animated element */}
        <div className="flex flex-col lg:flex-row items-center gap-10 mb-12">
          {/* Copy */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 tracking-tight">
              Create Animations by Chatting
            </h2>
            <p className="mt-4 text-lg text-zinc-400 max-w-lg mx-auto lg:mx-0">
              Describe what you want in plain English and the AI builds
              production-ready Lottie animations in seconds.
            </p>
            <div className="mt-8">
              <Link
                href="/editor/new"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-900/30"
              >
                Start Creating
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Animated element: floating chat bubbles */}
          <div className="relative w-56 h-44 shrink-0" aria-hidden="true">
            {/* Floating orbs */}
            <div className="absolute top-2 left-4 w-16 h-16 rounded-full bg-violet-500/20 blur-xl animate-[heroFloat_6s_ease-in-out_infinite]" />
            <div className="absolute bottom-4 right-6 w-20 h-20 rounded-full bg-indigo-500/20 blur-xl animate-[heroFloat_6s_ease-in-out_2s_infinite]" />
            <div className="absolute top-12 right-10 w-12 h-12 rounded-full bg-blue-500/20 blur-xl animate-[heroFloat_6s_ease-in-out_4s_infinite]" />

            {/* Chat bubbles */}
            <div className="absolute top-0 left-0 px-4 py-2 rounded-2xl rounded-bl-sm bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 animate-[heroFadeUp_5s_ease-in-out_infinite]">
              A bouncing ball
            </div>
            <div className="absolute top-10 right-0 px-4 py-2 rounded-2xl rounded-br-sm bg-violet-600/80 border border-violet-500/50 text-sm text-white animate-[heroFadeUp_5s_ease-in-out_1s_infinite]">
              Make it spin
            </div>
            <div className="absolute bottom-0 left-6 px-4 py-2 rounded-2xl rounded-bl-sm bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 animate-[heroFadeUp_5s_ease-in-out_2s_infinite]">
              Add a gradient
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Describe It */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="w-10 h-10 rounded-lg bg-violet-600/15 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Describe It</h3>
            <p className="text-sm text-zinc-400">Tell the AI what you want to see in plain English</p>
          </div>

          {/* See It Instantly */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/15 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">See It Instantly</h3>
            <p className="text-sm text-zinc-400">Watch your animation come to life in real time</p>
          </div>

          {/* Share & Export */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="w-10 h-10 rounded-lg bg-blue-600/15 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Share &amp; Export</h3>
            <p className="text-sm text-zinc-400">Download as Lottie JSON or share with a link</p>
          </div>
        </div>

        {/* Dismiss text link */}
        <div className="mt-6 text-center">
          <button
            onClick={onDismiss}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Got it, don&apos;t show again
          </button>
        </div>
      </div>
    </section>
  );
}
