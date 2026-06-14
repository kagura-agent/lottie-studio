import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownMessageProps {
  content: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold mb-1 mt-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mb-1 mt-1.5 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block bg-zinc-800 p-2 rounded text-xs overflow-x-auto mb-2 last:mb-0">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-zinc-800 px-1 py-0.5 rounded text-xs">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 last:mb-0">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-zinc-500 pl-2 text-zinc-300 mb-2 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-zinc-600 my-2" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-zinc-600 px-2 py-1 text-left font-semibold bg-zinc-800">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-600 px-2 py-1">{children}</td>
  ),
};

const remarkPlugins = [remarkGfm];

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-message">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
