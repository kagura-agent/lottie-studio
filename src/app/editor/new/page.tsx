"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BOUNCING_CIRCLE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 400,
  nm: "Bouncing Circle",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 0,
      ty: 4,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: {
          a: 1,
          k: [
            {
              t: 0,
              s: [200, 100, 0],
              e: [200, 300, 0],
              to: [0, 20, 0],
              ti: [0, 0, 0],
            },
            {
              t: 30,
              s: [200, 300, 0],
              e: [200, 100, 0],
              to: [0, 0, 0],
              ti: [0, 20, 0],
            },
            { t: 60, s: [200, 100, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100], e: [100, 80, 100] },
            { t: 28, s: [100, 80, 100], e: [120, 70, 100] },
            { t: 32, s: [120, 70, 100], e: [100, 100, 100] },
            { t: 60, s: [100, 100, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              d: 1,
              s: { a: 0, k: [80, 80] },
              p: { a: 0, k: [0, 0] },
            },
            {
              ty: "fl",
              c: { a: 0, k: [0.4, 0.6, 1, 1] },
              o: { a: 0, k: 100 },
              r: 1,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
          nm: "Circle Shape",
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Shadow",
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [20], e: [50] },
            { t: 30, s: [50], e: [20] },
            { t: 60, s: [20] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [200, 340, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [60, 20, 100], e: [100, 20, 100] },
            { t: 30, s: [100, 20, 100], e: [60, 20, 100] },
            { t: 60, s: [60, 20, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          it: [
            {
              ty: "el",
              d: 1,
              s: { a: 0, k: [80, 20] },
              p: { a: 0, k: [0, 0] },
            },
            {
              ty: "fl",
              c: { a: 0, k: [0, 0, 0, 1] },
              o: { a: 0, k: 100 },
              r: 1,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
          nm: "Shadow Shape",
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
  markers: [],
};

export default function NewEditorPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const create = async () => {
      try {
        const res = await fetch("/api/animations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Untitled Animation", data: BOUNCING_CIRCLE }),
        });
        if (!res.ok) throw new Error("Failed to create animation");
        const result = await res.json();
        router.replace(`/editor/${result.id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create animation");
        setCreating(false);
      }
    };
    create();
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          Back to Gallery
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-400 text-sm">Creating new animation...</p>
    </div>
  );
}
