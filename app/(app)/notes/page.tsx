"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, SlidersHorizontal, X, MessageSquare, BookOpen, FileText, ChevronRight, MessageSquareText, Newspaper } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NoteCard } from "@/components/NoteCard";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useNotes } from "@/hooks/useNotes";
import { topicStudyPrompt } from "@/lib/chat-prompts";
import { currentAffairsLinkForTopic, isCurrentAffairsSectionName } from "@/lib/current-affairs-config";

const REVISION_STATUSES = [
  { value: "", label: "All" },
  { value: "not_started", label: "Not Started" },
  { value: "learning", label: "Learning" },
  { value: "needs_revision", label: "Needs Revision" },
  { value: "revised", label: "Revised" },
];

interface SyllabusEntry {
  name: string;
  parentId?: string;
  parentName?: string;
  grandparentName?: string;
  nodeType?: string;
}

interface SyllabusNode {
  id: string;
  name: string;
  nodeType: string;
  children: SyllabusNode[];
}

function makeTopicChatUrl(topicId: string, entry: SyllabusEntry): string {
  const hint = encodeURIComponent(topicStudyPrompt(entry.name));
  const subject = encodeURIComponent(entry.grandparentName || entry.parentName || "");
  const topic = encodeURIComponent(entry.name);
  return `/chat?hint=${hint}&subject=${subject}&topic=${topic}&topicId=${topicId}`;
}

export default function NotesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { notes, total, loading, error, fetchNotes, deleteNote } = useNotes();

  const subjectId = searchParams.get("subjectId") || "";
  const sectionId = searchParams.get("sectionId") || "";
  const topicId = searchParams.get("topicId") || "";
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [revisionStatus, setRevisionStatus] = useState("");
  const [syllabusMap, setSyllabusMap] = useState<Record<string, SyllabusEntry>>({});
  const [syllabusTree, setSyllabusTree] = useState<SyllabusNode[]>([]);
  // Most recently updated conversation per topicId, so we can offer "Continue chat"
  // instead of always starting a new one.
  const [conversationByTopic, setConversationByTopic] = useState<Record<string, string>>({});

  const activeFilterId = topicId || sectionId || subjectId;

  // In section/subject mode, show topic browser instead of notes list
  const isBrowseMode = !topicId && (sectionId || subjectId);

  const loadNotes = useCallback(() => {
    fetchNotes({ q, subjectId, sectionId, topicId, revisionStatus });
  }, [q, subjectId, sectionId, topicId, revisionStatus, fetchNotes]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    fetch("/api/syllabus")
      .then((r) => r.json())
      .then((data: SyllabusNode[]) => {
        if (!Array.isArray(data)) return;
        setSyllabusTree(data);
        const map: Record<string, SyllabusEntry> = {};
        data.forEach((subject) => {
          map[subject.id] = { name: subject.name, nodeType: subject.nodeType };
          subject.children?.forEach((section) => {
            map[section.id] = {
              name: section.name,
              parentId: subject.id,
              parentName: subject.name,
              nodeType: section.nodeType,
            };
            section.children?.forEach((topic) => {
              map[topic.id] = {
                name: topic.name,
                parentId: section.id,
                parentName: section.name,
                grandparentName: subject.name,
                nodeType: topic.nodeType,
              };
            });
          });
        });
        setSyllabusMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data: Array<{ id: string; topicId?: string }>) => {
        if (!Array.isArray(data)) return;
        // API returns conversations sorted by updatedAt desc, so the first one
        // seen per topicId is the most recently active conversation for it.
        const map: Record<string, string> = {};
        data.forEach((conv) => {
          if (conv.topicId && !map[conv.topicId]) {
            map[conv.topicId] = conv.id;
          }
        });
        setConversationByTopic(map);
      })
      .catch(() => {});
  }, []);

  // Topics to show in browse mode
  const browseTopics = useMemo(() => {
    if (!isBrowseMode) return [];

    if (sectionId) {
      // All topics whose parentId is this section
      return Object.entries(syllabusMap)
        .filter(([, e]) => e.nodeType === "topic" && e.parentId === sectionId)
        .map(([id, e]) => ({ id, ...e }));
    }

    if (subjectId) {
      // All topics under this subject (any section)
      return Object.entries(syllabusMap)
        .filter(([, e]) => {
          if (e.nodeType !== "topic") return false;
          const parent = e.parentId ? syllabusMap[e.parentId] : null;
          return parent?.parentId === subjectId || e.parentId === subjectId;
        })
        .map(([id, e]) => ({ id, ...e }));
    }

    return [];
  }, [isBrowseMode, sectionId, subjectId, syllabusMap]);

  // Note counts per topic (from notes already loaded for this section)
  const noteCountByTopic = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n) => {
      if (n.topicId) counts[n.topicId] = (counts[n.topicId] || 0) + 1;
    });
    return counts;
  }, [notes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotes();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
    } catch {
      alert("Failed to delete note");
    }
  };

  const activeEntry = syllabusMap[activeFilterId];
  const breadcrumb = activeEntry
    ? [activeEntry.grandparentName, activeEntry.parentName, activeEntry.name]
        .filter(Boolean)
        .join(" › ")
    : "";

  const topicEntry = topicId ? syllabusMap[topicId] : null;
  const isCATopic = isCurrentAffairsSectionName(topicEntry?.parentName);
  const existingTopicConversationId = topicId ? conversationByTopic[topicId] : undefined;
  const topicChatUrl = existingTopicConversationId
    ? `/chat/${existingTopicConversationId}`
    : topicEntry
    ? makeTopicChatUrl(topicId, topicEntry)
    : "";

  // ── TOPIC BROWSER (section/subject view) ───────────────────────────────────
  if (isBrowseMode) {
    const headerEntry = syllabusMap[sectionId || subjectId];
    const headerBreadcrumb = headerEntry
      ? [headerEntry.grandparentName, headerEntry.parentName].filter(Boolean).join(" › ")
      : "";

    const isCASection = isCurrentAffairsSectionName(headerEntry?.name);

    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {headerBreadcrumb && (
            <p className="text-xs text-gray-400 mb-1">{headerBreadcrumb}</p>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {headerEntry?.name || "Topics"}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {browseTopics.length} topic{browseTopics.length !== 1 ? "s" : ""} · Click a topic to study it
              </p>
            </div>
            <button
              onClick={() => router.push("/notes")}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
            >
              <X size={12} /> Clear filter
            </button>
          </div>
        </div>

        {isCASection && (
          <Link
            href="/current-affairs"
            className="flex items-center gap-3 bg-[#eef3fb] border border-[#1f4e9c]/30 rounded-xl p-4 mb-4 hover:shadow-sm transition-shadow"
          >
            <div className="w-9 h-9 rounded-lg bg-[#1f4e9c] flex items-center justify-center flex-shrink-0">
              <Newspaper size={18} className="text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Daily Current Affairs</p>
              <p className="text-xs text-gray-500">
                Today&apos;s news as a point-wise list, split into GS topics and Static GK. Build your monthly notes from it.
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
          </Link>
        )}

        {browseTopics.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No topics in this section yet</p>
            <p className="text-sm mt-1">Add topics from the Syllabus tree in the sidebar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {browseTopics.map((topic) => {
              const count = noteCountByTopic[topic.id] || 0;
              const existingConversationId = conversationByTopic[topic.id];
              return (
                <Link
                  key={topic.id}
                  href={`/notes?topicId=${topic.id}`}
                  className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1f4e9c] hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#e3ebf7] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText size={16} className="text-[#1f4e9c]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-0.5">
                        {topic.name}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {count === 0 ? "No notes yet" : `${count} note${count !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors"
                    />
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.preventDefault()}>
                    {isCASection ? (
                      <Link
                        href={currentAffairsLinkForTopic(topic.name)}
                        className="flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-[#1f4e9c] hover:bg-[#173d7d] rounded-md py-1.5 transition-colors">
                          <Newspaper size={12} />
                          Today&apos;s updates
                        </button>
                      </Link>
                    ) : (
                      <Link
                        href={existingConversationId ? `/chat/${existingConversationId}` : makeTopicChatUrl(topic.id, topic)}
                        className="flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-[#1f4e9c] hover:bg-[#173d7d] rounded-md py-1.5 transition-colors">
                          {existingConversationId ? <MessageSquareText size={12} /> : <MessageSquare size={12} />}
                          {existingConversationId ? "Continue chat" : "Chat about this"}
                        </button>
                      </Link>
                    )}
                    <Link
                      href={`/notes?topicId=${topic.id}`}
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 transition-colors">
                        <BookOpen size={12} />
                        View notes
                      </button>
                    </Link>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── TOPIC NOTES VIEW ───────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {topicId ? (
        <div className="mb-6">
          {topicEntry && (
            <p className="text-xs text-gray-400 mb-1">
              {[topicEntry.grandparentName, topicEntry.parentName].filter(Boolean).join(" › ")}
            </p>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={22} className="text-[#1f4e9c] flex-shrink-0" aria-hidden="true" />
                {topicEntry?.name || "Topic Notes"}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {total} note{total !== 1 ? "s" : ""} · Notes are only added via chat
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isCATopic && topicEntry && (
                <Link href={currentAffairsLinkForTopic(topicEntry.name)}>
                  <Button size="sm">
                    <Newspaper size={14} aria-hidden="true" />
                    Today&apos;s updates
                  </Button>
                </Link>
              )}
              <Link href={topicChatUrl || `/chat?topicId=${topicId}`}>
                <Button size="sm" variant={isCATopic ? "secondary" : "primary"}>
                  {existingTopicConversationId ? (
                    <MessageSquareText size={14} aria-hidden="true" />
                  ) : (
                    <MessageSquare size={14} aria-hidden="true" />
                  )}
                  {existingTopicConversationId ? "Continue chat" : "Chat about this topic"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
            <p className="text-gray-500 text-sm mt-1">
              {total} note{total !== 1 ? "s" : ""} saved
            </p>
          </div>
        </div>
      )}

      {topicId && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.back()}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X size={11} /> Clear filter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
              aria-label="Search notes"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={14} className="text-gray-400" aria-hidden="true" />
          <span className="text-xs text-gray-500 font-medium">Revision status:</span>
          {REVISION_STATUSES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRevisionStatus(value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                revisionStatus === value
                  ? "bg-[#1f4e9c] text-white border-[#1f4e9c]"
                  : "border-gray-300 text-gray-600 hover:border-[#1f4e9c]"
              }`}
              aria-pressed={revisionStatus === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadNotes} />
      ) : notes.length === 0 ? (
        <EmptyState
          title={topicId ? `No notes for ${topicEntry?.name || "this topic"} yet` : "No notes found"}
          description={
            topicId
              ? `Chat with the AI about "${topicEntry?.name || "this topic"}" and save a note from that conversation.`
              : q
              ? `No notes match "${q}". Try a different search.`
              : "Start chatting with the AI tutor on a topic and generate study notes."
          }
          action={
            topicId
              ? {
                  label: existingTopicConversationId
                    ? "Continue chat"
                    : `Chat about ${topicEntry?.name || "this topic"}`,
                  onClick: () => router.push(topicChatUrl || `/chat?topicId=${topicId}`),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              subjectName={note.subjectId ? syllabusMap[note.subjectId]?.name : undefined}
              sectionName={note.sectionId ? syllabusMap[note.sectionId]?.name : undefined}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
