"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Send, ExternalLink } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import ModelSelector from "@/components/ModelSelector";
import { useChat } from "@/hooks/useChat";

interface ReviseChatDialogProps {
  topic: string;
  point: string;
  onClose: () => void;
}

function initialMessage(topic: string, point: string): string {
  return `Help me revise "${topic}". It came up in current affairs: "${point}". Explain the key static facts I must remember, then quiz me with 3 short questions.`;
}

export function ReviseChatDialog({ topic, point, onClose }: ReviseChatDialogProps) {
  const { conversationId, messages, loading, sendMessage } = useChat(
    undefined,
    undefined,
    undefined,
    undefined,
    { stayInPlace: true }
  );
  const [input, setInput] = useState(() => initialMessage(topic, point));
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const ok = await sendMessage(text);
    if (!ok) {
      setInput(text);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revise-dialog-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 id="revise-dialog-title" className="text-xs font-semibold uppercase tracking-wider text-[#1f4e9c]">
              Revise
            </h2>
            <p className="text-sm font-medium text-gray-900 mt-1">{topic}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-gray-500 px-5 py-6">
              Your message is ready below. Edit it if you like, then press Send to start revising.
            </p>
          )}
          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} timestamp={m.timestamp} />
          ))}
          {loading && (
            <div className="flex items-center gap-3 px-4 py-4 bg-slate-50 text-sm text-gray-500">
              <LoadingSpinner size="sm" />
              Thinking...
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <ModelSelector />
            {conversationId && (
              <Link
                href={`/chat/${conversationId}`}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#1f4e9c]"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Open in full chat
              </Link>
            )}
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={3}
              disabled={loading}
              aria-label="Revision message"
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-40"
            />
            <Button onClick={handleSend} disabled={!input.trim() || loading} loading={loading} aria-label="Send message">
              <Send size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviseChatDialog;
