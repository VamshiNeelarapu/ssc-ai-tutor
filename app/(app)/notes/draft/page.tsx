"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Edit3, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NoteViewer } from "@/components/NoteViewer";
import type { NoteDraft } from "@/hooks/useChat";
import type { NoteDetail } from "@/hooks/useNotes";

interface DraftSession {
  draft: NoteDraft;
  draftData: {
    subjectId?: string;
    sectionId?: string;
    topicId?: string;
    suggestedSubject?: { id: string; name: string; slug: string } | null;
    suggestedSection?: { id: string; name: string; slug: string } | null;
    sourceConversationId?: string;
  };
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "its", "their", "with", "by"]);

function getSignificantWords(title: string): Set<string> {
  return new Set(
    title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function titleSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export default function DraftReviewPage() {
  const router = useRouter();
  const [session, setSession] = useState<DraftSession | null>(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");
  const [existingNote, setExistingNote] = useState<{ id: string; title: string; isFuzzyMatch?: boolean } | null>(null);
  const [syllabus, setSyllabus] = useState<
    Array<{
      id: string;
      name: string;
      children: Array<{
        id: string;
        name: string;
        children?: Array<{ id: string; name: string }>;
      }>;
    }>
  >([]);

  useEffect(() => {
    // Load draft from session storage
    const raw = sessionStorage.getItem("noteDraft");
    if (!raw) {
      router.push("/chat");
      return;
    }

    try {
      const parsed: DraftSession = JSON.parse(raw);
      setSession(parsed);
      setTitle(parsed.draft.title || "");
      setSubjectId(parsed.draftData.subjectId || parsed.draftData.suggestedSubject?.id || "");
      setSectionId(parsed.draftData.sectionId || parsed.draftData.suggestedSection?.id || "");
      setTopicId(parsed.draftData.topicId || "");

      // No topicId — check title similarity to detect accidental duplicates
      if (!parsed.draftData.topicId && parsed.draft.title) {
        fetch(`/api/notes?q=${encodeURIComponent(parsed.draft.title)}&limit=5`)
          .then((r) => r.json())
          .then((data) => {
            if (!data?.notes?.length) return;
            const draftWords = getSignificantWords(parsed.draft.title);
            for (const note of data.notes) {
              if (titleSimilarity(draftWords, getSignificantWords(note.title)) > 0.5) {
                setExistingNote({ id: note.id, title: note.title, isFuzzyMatch: true });
                break;
              }
            }
          })
          .catch(() => {});
      }
    } catch {
      router.push("/chat");
    }

    // Load syllabus
    fetch("/api/syllabus")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSyllabus(data);
      })
      .catch(() => {});
  }, [router]);

  const sections = syllabus.find((s) => s.id === subjectId)?.children || [];
  const topics = sections.find((s) => s.id === sectionId)?.children || [];

  // Re-check for an existing note whenever the chosen topic changes
  useEffect(() => {
    if (!topicId) {
      setExistingNote((prev) => (prev && !prev.isFuzzyMatch ? null : prev));
      return;
    }
    let cancelled = false;
    fetch(`/api/notes?topicId=${encodeURIComponent(topicId)}&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.notes?.length > 0) {
          setExistingNote({ id: data.notes[0].id, title: data.notes[0].title });
        } else {
          setExistingNote((prev) => (prev && !prev.isFuzzyMatch ? null : prev));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const handleMerge = async () => {
    if (!session || !existingNote) return;
    setMerging(true);
    setError("");

    try {
      const mergeContent = {
        overview: session.draft.overview,
        coreConcepts: session.draft.coreConcepts,
        keyFacts: session.draft.keyFacts,
        shortcuts: session.draft.shortcuts,
        revisionTips: session.draft.revisionTips,
        commonConfusions: session.draft.commonConfusions,
        mcqs: session.draft.mcqs.map((m) => ({
          ...m,
          sourceStatus: m.sourceStatus || "generated",
        })),
        workedExamples: session.draft.workedExamples,
        references: session.draft.references.map((r) => ({
          ...r,
          verificationStatus: r.verificationStatus || "unverified",
        })),
      };

      const res = await fetch(`/api/notes/${existingNote.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: mergeContent }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to merge note");
      }

      sessionStorage.removeItem("noteDraft");
      router.push(`/notes/${existingNote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge note");
    } finally {
      setMerging(false);
    }
  };

  const handleSave = async () => {
    if (!session || !title) return;
    setSaving(true);
    setError("");

    try {
      const noteData = {
        title,
        subjectId: subjectId || undefined,
        sectionId: sectionId || undefined,
        topicId: topicId || undefined,
        examRelevance: session.draft.examRelevance || ["tier1"],
        content: {
          overview: session.draft.overview,
          coreConcepts: session.draft.coreConcepts,
          keyFacts: session.draft.keyFacts,
          shortcuts: session.draft.shortcuts,
          revisionTips: session.draft.revisionTips,
          commonConfusions: session.draft.commonConfusions,
          mcqs: session.draft.mcqs.map((m) => ({
            ...m,
            sourceStatus: m.sourceStatus || "generated",
          })),
          workedExamples: session.draft.workedExamples,
          references: session.draft.references.map((r) => ({
            ...r,
            verificationStatus: r.verificationStatus || "unverified",
          })),
        },
        revisionStatus: "not_started",
        sourceConversationId: session.draftData.sourceConversationId || undefined,
      };

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note");
      }

      const savedNote = await res.json();
      sessionStorage.removeItem("noteDraft");
      router.push(`/notes/${savedNote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Build a NoteDetail-shaped object for NoteViewer
  const previewNote: NoteDetail = {
    id: "draft",
    title,
    revisionStatus: "not_started",
    examRelevance: session.draft.examRelevance || ["tier1"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: {
      overview: session.draft.overview,
      coreConcepts: session.draft.coreConcepts || [],
      keyFacts: session.draft.keyFacts || [],
      shortcuts: session.draft.shortcuts || [],
      revisionTips: session.draft.revisionTips || [],
      commonConfusions: session.draft.commonConfusions || [],
      mcqs: (session.draft.mcqs || []).map((m) => ({
        ...m,
        sourceStatus: m.sourceStatus || "generated",
      })),
      workedExamples: session.draft.workedExamples || [],
      references: (session.draft.references || []).map((r) => ({
        ...r,
        verificationStatus: (r.verificationStatus as "verified" | "unverified") || "unverified",
      })),
    },
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Note Draft</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and edit before saving
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            size="md"
            onClick={handleSave}
            loading={saving}
            disabled={!title}
          >
            <Save size={14} aria-hidden="true" />
            Save Note
          </Button>
        </div>
      </div>

      {/* Existing note notice */}
      {existingNote && (
        <div className="mb-4 px-4 py-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900 mb-1 font-medium">
            {existingNote.isFuzzyMatch ? "A similar note already exists" : "Existing note found for this topic"}
          </p>
          <p className="text-sm text-amber-800 mb-3">
            {existingNote.isFuzzyMatch
              ? <>Looks like you may already have notes on this: <strong>{existingNote.title}</strong>. Update it instead of creating a duplicate?</>
              : <>This topic already has a saved note: <strong>{existingNote.title}</strong></>
            }
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleMerge}
              loading={merging}
            >
              Update existing note
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExistingNote(null)}
            >
              Save as new note
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Edit panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Edit3 size={14} aria-hidden="true" />
              Note Details
            </h2>

            <div className="space-y-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Note title"
              />

              {/* Subject selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Subject</label>
                <div className="relative">
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value);
                      setSectionId("");
                      setTopicId("");
                    }}
                    className="w-full h-10 appearance-none border border-gray-300 rounded-md px-3 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Select subject"
                  >
                    <option value="">Select subject...</option>
                    {syllabus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Section selector */}
              {sections.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Section</label>
                  <div className="relative">
                    <select
                      value={sectionId}
                      onChange={(e) => {
                        setSectionId(e.target.value);
                        setTopicId("");
                      }}
                      className="w-full h-10 appearance-none border border-gray-300 rounded-md px-3 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Select section"
                    >
                      <option value="">Select section...</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

              {/* Topic selector */}
              {topics.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Topic</label>
                  <div className="relative">
                    <select
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                      className="w-full h-10 appearance-none border border-gray-300 rounded-md px-3 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Select topic"
                    >
                      <option value="">No specific topic</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

              {/* AI suggestion */}
              {(session.draftData.suggestedSubject || session.draftData.suggestedSection) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                  <p className="font-medium mb-1">AI Suggestion:</p>
                  <p>
                    {session.draftData.suggestedSubject?.name}
                    {session.draftData.suggestedSection
                      ? ` > ${session.draftData.suggestedSection.name}`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Content Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Core concepts</dt>
                <dd className="font-medium">{session.draft.coreConcepts?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Key facts</dt>
                <dd className="font-medium">{session.draft.keyFacts?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Shortcuts</dt>
                <dd className="font-medium">{session.draft.shortcuts?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">MCQs</dt>
                <dd className="font-medium">{session.draft.mcqs?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Worked examples</dt>
                <dd className="font-medium">{session.draft.workedExamples?.length || 0}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{title || "Untitled Note"}</h2>
          <NoteViewer note={previewNote} />
        </div>
      </div>
    </div>
  );
}
