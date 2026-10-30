"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ChatMessage from "@/components/ChatMessage";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useChat } from "@/hooks/useChat";
import { useConversationDelete } from "@/hooks/useConversationDelete";
import type { ChatMessage as ChatMsg } from "@/hooks/useChat";
import ModelSelector from "@/components/ModelSelector";
import { SAMPLE_PROMPTS, topicStudyPrompt, topicChatUrl } from "@/lib/chat-prompts";
import VoiceInputButton from "@/components/VoiceInputButton";
import { useVoiceInput } from "@/hooks/useSpeechToText";

interface ConversationPageProps {
  params: { conversationId: string };
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const router = useRouter();
  const {
    conversationId,
    messages,
    loading,
    sendMessage,
    setMessages,
  } = useChat(params.conversationId);

  const [input, setInput] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [conversationTopic, setConversationTopic] = useState<string | null>(null);
  const [conversationSection, setConversationSection] = useState<string | null>(null);
  const [conversationSubject, setConversationSubject] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceInput({
    setText: setInput,
    onEnd: () => inputRef.current?.focus(),
  });

  // Load existing conversation
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const res = await fetch(`/api/conversations/${params.conversationId}`);
        if (!res.ok) {
          router.push("/chat");
          return;
        }
        const data = await res.json();
        setConversationTopic(data.topic || null);
        setConversationSection(data.section || null);
        setConversationSubject(data.subject || null);
        setMessages(
          data.messages.map((m: ChatMsg) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }))
        );
      } catch {
        router.push("/chat");
      } finally {
        setInitialLoading(false);
      }
    };

    loadConversation();
  }, [params.conversationId, router, setMessages]);

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

  const { requestDelete, dialog: deleteDialog } = useConversationDelete((_id, info) =>
    router.push(info.topic ? topicChatUrl({ ...info, topic: info.topic }) : "/chat")
  );
  const handleDelete = () => requestDelete({ id: params.conversationId, title: "this chat" });

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-clip">
      {deleteDialog}
      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-clip">
        {/* Conversation header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              Conversation
            </h1>
            <p className="text-xs text-gray-500">
              {messages.length} messages
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50"
            aria-label="Delete conversation"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full px-4 py-16 text-center">
              <div className="text-5xl mb-4" aria-hidden="true">🎓</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {conversationTopic ? `Start studying ${conversationTopic}` : "This chat is empty"}
              </h2>
              <p className="text-gray-500 max-w-md text-sm">
                Pick a suggestion or type your own question below.
              </p>
              <div
                className={`mt-6 grid grid-cols-1 gap-2 w-full max-w-lg ${
                  conversationTopic ? "" : "sm:grid-cols-2"
                }`}
              >
                {(conversationTopic ? [topicStudyPrompt(conversationTopic, conversationSection ?? undefined, conversationSubject ?? undefined)] : SAMPLE_PROMPTS).map((prompt) => (
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
          )}
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

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <ModelSelector />
          </div>

          {conversationTopic && messages.some((m) => m.role === "assistant") && (
            <div className="mb-3">
              <span className="text-xs text-gray-400">
                Topic: <span className="font-medium text-gray-600">{conversationTopic}</span>
              </span>
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
              placeholder={voice.listening ? "Listening... speak now" : "Continue the conversation..."}
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
        </div>
      </div>
    </div>
  );
}
