import Link from "next/link";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6">
      <h1 className="text-2xl font-semibold text-zinc-100">Editor</h1>
      <p className="text-sm text-zinc-400">
        Editing animation: <code className="text-zinc-300">{id}</code>
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
      >
        Back to Gallery
      </Link>
    </div>
  );
}
