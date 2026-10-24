"use client";

import { useState, useCallback } from "react";

export interface Note {
  id: string;
  title: string;
  subjectId?: string;
  sectionId?: string;
  topicId?: string;
  examRelevance: string[];
  revisionStatus: "not_started" | "learning" | "needs_revision" | "revised";
  sourceConversationId?: string;
  kind?: "note" | "current_affairs_month" | "chapter_summary";
  monthKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail extends Note {
  content: {
    overview?: string;
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
      sourceStatus: string;
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
  };
}

export interface NotesFilters {
  q?: string;
  subjectId?: string;
  sectionId?: string;
  topicId?: string;
  revisionStatus?: string;
  page?: number;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async (filters: NotesFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);
      if (filters.sectionId) params.set("sectionId", filters.sectionId);
      if (filters.topicId) params.set("topicId", filters.topicId);
      if (filters.revisionStatus) params.set("revisionStatus", filters.revisionStatus);
      if (filters.page) params.set("page", String(filters.page));

      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch notes");

      const data = await res.json();
      setNotes(data.notes);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(async (noteData: Partial<NoteDetail>): Promise<NoteDetail> => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteData),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create note");
    }

    return res.json();
  }, []);

  const updateNote = useCallback(
    async (id: string, updates: Partial<NoteDetail>): Promise<NoteDetail> => {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update note");
      }

      return res.json();
    },
    []
  );

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete note");
    }

    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const updateRevisionStatus = useCallback(
    async (
      id: string,
      status: "not_started" | "learning" | "needs_revision" | "revised"
    ) => {
      const res = await fetch(`/api/notes/${id}/revision-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionStatus: status }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      const data = await res.json();
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, revisionStatus: data.revisionStatus } : n
        )
      );

      return data;
    },
    []
  );

  return {
    notes,
    total,
    loading,
    error,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    updateRevisionStatus,
  };
}
