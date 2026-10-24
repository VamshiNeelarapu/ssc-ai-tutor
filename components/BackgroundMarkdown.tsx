"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function BackgroundMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-gray-800 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-gray-900 mt-4 mb-1.5 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-1">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default BackgroundMarkdown;
