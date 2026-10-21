"use client";

import { clsx } from "clsx";
import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={clsx("flex gap-3 px-4 py-4", isUser ? "bg-white" : "bg-slate-50")}>
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5",
          isUser ? "bg-blue-100 text-blue-600" : "bg-[#1f4e9c] text-white"
        )}
        aria-hidden="true"
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-gray-900">
            {isUser ? "You" : "SSC Tutor"}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {isUser ? (
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-sm text-gray-800 leading-relaxed markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold text-gray-900 mt-4 mb-2 first:mt-0 border-b border-gray-200 pb-1">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold text-gray-800 mt-3 mb-1.5">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-[#1f4e9c] pl-3 my-2 text-gray-600 italic bg-blue-50 py-1 rounded-r">{children}</blockquote>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  return isBlock ? (
                    <code className="block bg-gray-900 text-gray-100 rounded-md p-3 my-2 text-xs overflow-x-auto font-mono whitespace-pre">
                      {children}
                    </code>
                  ) : (
                    <code className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
                  );
                },
                pre: ({ children }) => <div className="my-2">{children}</div>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">{children}</table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-[#1f4e9c] text-white">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left font-semibold border border-[#1a4590]">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 border border-gray-200">{children}</td>
                ),
                tr: ({ children }) => (
                  <tr className="even:bg-gray-50">{children}</tr>
                ),
                hr: () => <hr className="my-4 border-gray-200" />,
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">{children}</strong>
                ),
                em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                a: ({ href, children }) => (
                  <a href={href} className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">{children}</a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
