"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getStoredModel } from "@/lib/models";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface NoteDraft {
  title: string;
  overview?: string;
  examRelevance: string[];
  coreConcepts: Array<{ heading: string; body: string }>;
  keyFacts: string[];
  shortcuts: string[];
  revisionTips: string[];
  commonConfusions: string[];
  mcqs: Array<{
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
    sourceStatus?: string;
  }>;
  workedExamples: Array<{
    question: string;
    approach?: string;
    steps?: string[];
  }>;
  references: Array<{
    title: string;
    url?: string;
    publisher?: string;
    verificationStatus: string;
  }>;
  suggestedSubject?: string;
  suggestedSection?: string;
}

export function useChat(initialConversationId?: string, subject?: string, topic?: string, topicId?: string) {
  const router = useRouter();
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftData, setDraftData] = useState<{
    subjectId?: string;
    sectionId?: string;
    topicId?: string;
    suggestedSubject?: { id: string; name: string; slug: string } | null;
    suggestedSection?: { id: string; name: string; slug: string } | null;
    sourceConversationId?: string;
  } | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            conversationId,
            model: getStoredModel(),
            // Only send subject/topic on the very first message (when conversation doesn't exist yet)
            ...(!conversationId && subject ? { subject } : {}),
            ...(!conversationId && topic ? { topic } : {}),
            ...(!conversationId && topicId ? { topicId } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to send message");
        }

        const data = await res.json();
        setConversationId(data.conversationId);

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message.content,
          timestamp: data.message.timestamp,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        window.dispatchEvent(new Event("conversations:refresh"));

        // Move a brand-new chat to its own URL so Back/refresh reload the saved conversation.
        // Skip if the user already navigated away while the reply was loading.
        if (!initialConversationId && data.conversationId && mountedRef.current) {
          router.replace(`/chat/${data.conversationId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        // Remove the optimistic user message
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [conversationId, initialConversationId, subject, topic, topicId, router]
  );

  const generateDraft = useCallback(async () => {
    if (!conversationId) {
      setError("No conversation to generate notes from");
      return;
    }

    setDraftLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/notes/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, model: getStoredModel(), ...(topicId ? { topicId } : {}) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate draft");
      }

      const data = await res.json();
      setDraft(data.draft);
      setDraftData({
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        topicId: data.topicId,
        suggestedSubject: data.suggestedSubject,
        suggestedSection: data.suggestedSection,
        sourceConversationId: conversationId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setDraftLoading(false);
    }
  }, [conversationId, topicId]);

  const clearDraft = useCallback(() => {
    setDraft(null);
    setDraftData(null);
  }, []);

  return {
    conversationId,
    messages,
    loading,
    error,
    draft,
    draftData,
    draftLoading,
    sendMessage,
    generateDraft,
    clearDraft,
    setMessages,
  };
}
