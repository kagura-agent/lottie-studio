"use client";

export default function PremiumBadge() {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 bg-zinc-900/90 border border-amber-600/40 rounded-full">
      <svg
        className="w-3 h-3 text-amber-400"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
      </svg>
      <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
        Pro
      </span>
    </div>
  );
}
