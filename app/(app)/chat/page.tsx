"use client";

import { useState, useRef, useEffect } from "react";
import { Send, BookOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatMessage from "@/components/ChatMessage";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChat } from "@/hooks/useChat";
import ModelSelector from "@/components/ModelSelector";
import { SAMPLE_PROMPTS } from "@/lib/chat-prompts";
import VoiceInputButton from "@/components/VoiceInputButton";
import { useVoiceInput } from "@/hooks/useSpeechToText";

export default function NewChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hint = searchParams.get("hint") || "";
  const subject = searchParams.get("subject") || undefined;
  const topic = searchParams.get("topic") || undefined;
  const topicId = searchParams.get("topicId") || undefined;

  const {
    conversationId,
    messages,
    loading,

    sendMessage,

  } = useChat(undefined, subject, topic, topicId);

  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceInput({
    setText: setInput,
    onEnd: () => inputRef.current?.focus(),
  });

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading) return;
    voice.cancel();
    setInput("");
    const ok = await sendMessage(message);
    if (!ok) {
      setInput(message);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-clip">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-clip">
        {/* Scope banner */}
        {(topic || subject) && messages.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-blue-700 text-sm">
            <BookOpen size={14} aria-hidden="true" />
            {topic ? (
              <span>
                Focused on <strong>{topic}</strong>
                {subject ? <span className="text-blue-500 font-normal"> · {subject}</span> : null}
                {" "}— chat won't drift to other topics.
              </span>
            ) : (
              <span>Focused on <strong>{subject}</strong> — replies will stay within this subject.</span>
            )}
          </div>
        )}
        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
              <div className="text-5xl mb-4" aria-hidden="true">🎓</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Ask your SSC AI Tutor
              </h2>
              <p className="text-gray-500 max-w-md text-sm">
                Ask about any SSC CGL topic. The AI will teach you in a structured,
                exam-focused way and help you create study notes.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      voice.cancel();
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="text-left text-sm px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-gray-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((message, i) => (
                <ChatMessage
                  key={i}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                />
              ))}

              {loading && (
                <div className="flex gap-3 px-4 py-4 bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <LoadingSpinner size="sm" />
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <ModelSelector />
          </div>

          {hint && messages.length === 0 && !input.trim() && (
            <div className="mb-2">
              <p className="text-xs text-gray-400 mb-1">Suggested question:</p>
              <button
                onClick={() => { voice.cancel(); setInput(hint); inputRef.current?.focus(); }}
                className="text-left text-xs px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors w-full truncate"
              >
                {hint}
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                if (voice.listening) voice.cancel();
                setInput(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                voice.listening
                  ? "Listening... speak now"
                  : "Ask about any SSC CGL topic... (Enter to send, Shift+Enter for new line)"
              }
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] max-h-32"
              rows={1}
              aria-label="Chat message input"
              disabled={loading}
            />
            <VoiceInputButton
              listening={voice.listening}
              lang={voice.lang}
              onLangChange={voice.setLang}
              onToggle={() => (voice.listening ? voice.stop() : voice.start(input))}
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              loading={loading}
              aria-label="Send message"
            >
              <Send size={16} aria-hidden="true" />
            </Button>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
