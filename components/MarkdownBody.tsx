"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders pasted notes as a clean, readable document: headings, lists and tables
export function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <div className="text-sm text-gray-800 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mb-3 mt-1">{children}</h1>,
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-gray-900 mt-8 mb-3 pb-1 border-b border-gray-200">{children}</h2>
          ),
          h3: ({ children }) => <h3 className="text-base font-semibold text-gray-900 mt-6 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-800 mt-4 mb-1.5">{children}</h4>,
          h5: ({ children }) => <h5 className="text-sm font-semibold text-gray-700 mt-3 mb-1">{children}</h5>,
          h6: ({ children }) => <h6 className="text-sm font-semibold text-gray-700 mt-3 mb-1">{children}</h6>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-6 border-gray-200" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#1f4e9c] bg-[#e3ebf7] pl-3 pr-2 py-1 my-3 rounded-r">{children}</blockquote>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#e3ebf7] text-gray-900">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold border-b border-gray-200 whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 align-top border-b border-gray-100">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-gray-50">{children}</tr>,
          a: ({ href, children }) => (
            <a href={href} className="text-[#1f4e9c] underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownBody;
