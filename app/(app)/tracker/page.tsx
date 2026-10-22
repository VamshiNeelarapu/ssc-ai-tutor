"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";

interface TreeNode {
  id: string;
  name: string;
  nodeType: string;
  children: TreeNode[];
}

interface TopicProgress {
  chatCount: number;
  chatMessages: number;
  noteId?: string;
  noteStatus?: string;
  quizAttempts: number;
  lastAccuracy?: number;
  avgAccuracy?: number;
  lastActivity?: string;
}

type TopicState = "revised" | "needs_revision" | "learning" | "notes_made" | "chat_only" | "not_started";

const STATES: Array<{ id: TopicState; label: string; bar: string; pill: string }> = [
  { id: "revised", label: "Revised", bar: "bg-green-500", pill: "bg-green-100 text-green-700" },
  { id: "needs_revision", label: "Needs revision", bar: "bg-amber-400", pill: "bg-amber-100 text-amber-700" },
  { id: "learning", label: "Learning", bar: "bg-blue-500", pill: "bg-blue-100 text-blue-700" },
  { id: "notes_made", label: "Notes made", bar: "bg-slate-400", pill: "bg-slate-100 text-slate-700" },
  { id: "chat_only", label: "Chat only", bar: "bg-sky-300", pill: "bg-sky-100 text-sky-700" },
  { id: "not_started", label: "Not started", bar: "bg-gray-200", pill: "bg-gray-100 text-gray-500" },
];

function stateOf(p?: TopicProgress): TopicState {
  if (!p) return "not_started";
  if (p.noteStatus === "revised") return "revised";
  if (p.noteStatus === "needs_revision") return "needs_revision";
  if (p.noteStatus === "learning") return "learning";
  if (p.noteId) return "notes_made";
  if (p.chatCount > 0) return "chat_only";
  return "not_started";
}

function countStates(topics: TreeNode[], progress: Record<string, TopicProgress>) {
  const counts: Record<TopicState, number> = {
    revised: 0, needs_revision: 0, learning: 0, notes_made: 0, chat_only: 0, not_started: 0,
  };
  for (const t of topics) counts[stateOf(progress[t.id])] += 1;
  return counts;
}

function StackedBar({ counts, total }: { counts: Record<TopicState, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100" role="img" aria-label="Progress breakdown">
      {STATES.filter((s) => s.id !== "not_started").map((s) =>
        counts[s.id] > 0 ? (
          <div
            key={s.id}
            className={s.bar}
            style={{ width: `${(counts[s.id] / total) * 100}%` }}
            title={`${s.label}: ${counts[s.id]}`}
          />
        ) : null
      )}
    </div>
  );
}

function topicsOf(section: TreeNode): TreeNode[] {
  return section.children.filter((c) => c.nodeType === "topic");
}

export default function TrackerPage() {
  const { showError } = useErrorPopup();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [progress, setProgress] = useState<Record<string, TopicProgress>>({});
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<"" | TopicState>("");
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [syllabusRes, trackerRes] = await Promise.all([fetch("/api/syllabus"), fetch("/api/tracker")]);
        if (!syllabusRes.ok) {
          showError(await readApiError(syllabusRes, "Failed to load the syllabus"));
          return;
        }
        if (!trackerRes.ok) {
          showError(await readApiError(trackerRes, "Failed to load your progress"));
          return;
        }
        const syllabus = await syllabusRes.json();
        const tracker = await trackerRes.json();
        setTree(Array.isArray(syllabus) ? syllabus.filter((n: TreeNode) => n.nodeType === "subject") : []);
        setProgress(tracker.topics ?? {});
      } catch (err) {
        showError(toAppError(err, "Failed to load the tracker"));
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const visibleSubjects = useMemo(
    () => tree.filter((s) => !subjectFilter || s.id === subjectFilter),
    [tree, subjectFilter]
  );

  const allTopics = useMemo(
    () => visibleSubjects.flatMap((s) => s.children.flatMap((sec) => topicsOf(sec))),
    [visibleSubjects]
  );

  const totals = useMemo(() => {
    const counts = countStates(allTopics, progress);
    const accuracies = allTopics
      .map((t) => progress[t.id]?.avgAccuracy)
      .filter((a): a is number => a !== undefined);
    return {
      counts,
      total: allTopics.length,
      chatsStarted: allTopics.filter((t) => (progress[t.id]?.chatCount ?? 0) > 0).length,
      notesMade: allTopics.filter((t) => progress[t.id]?.noteId).length,
      avgAccuracy: accuracies.length ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : null,
    };
  }, [allTopics, progress]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <BarChart3 size={22} className="text-[#1f4e9c]" aria-hidden="true" />
        Progress Tracker
      </h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Every topic, with whether you started a chat, the state of its note, and your quiz results.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          ["Topics", totals.total],
          ["Chats started", totals.chatsStarted],
          ["Notes made", totals.notesMade],
          ["Revised", totals.counts.revised],
          ["Quiz accuracy", totals.avgAccuracy === null ? "—" : `${totals.avgAccuracy}%`],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <StackedBar counts={totals.counts} total={totals.total} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {STATES.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-2.5 h-2.5 rounded-sm ${s.bar}`} aria-hidden="true" />
              {s.label} <span className="text-gray-400">{totals.counts[s.id]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Filter by subject"
          className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white"
        >
          <option value="">All subjects</option>
          {tree.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as "" | TopicState)}
          aria-label="Filter by status"
          className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          {STATES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Subjects */}
      <div className="space-y-3">
        {visibleSubjects.map((subject) => {
          const sections = subject.children.filter((c) => c.nodeType === "section");
          const subjectTopics = sections.flatMap(topicsOf);
          const counts = countStates(subjectTopics, progress);
          const started = subjectTopics.length - counts.not_started;
          const open = openSubjects.has(subject.id);

          return (
            <section key={subject.id} className="bg-white border border-gray-200 rounded-xl">
              <button
                onClick={() => toggle(openSubjects, subject.id, setOpenSubjects)}
                aria-expanded={open}
                title={subject.name}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-sm font-semibold text-gray-900 truncate">{subject.name}</h2>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      {started}/{subjectTopics.length} topics started
                    </span>
                  </div>
                  <StackedBar counts={counts} total={subjectTopics.length} />
                </div>
              </button>

              {open && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {sections.map((section) => {
                    const topics = topicsOf(section);
                    const sectionCounts = countStates(topics, progress);
                    const shown = topics.filter((t) => !stateFilter || stateOf(progress[t.id]) === stateFilter);
                    if (stateFilter && shown.length === 0) return null;
                    const sectionOpen = openSections.has(section.id) || !!stateFilter;
                    const sectionStarted = topics.length - sectionCounts.not_started;

                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => toggle(openSections, section.id, setOpenSections)}
                          aria-expanded={sectionOpen}
                          title={section.name}
                          className="w-full flex items-center gap-3 px-4 py-3 pl-8 text-left hover:bg-gray-50"
                        >
                          {sectionOpen ? (
                            <ChevronDown size={14} aria-hidden="true" />
                          ) : (
                            <ChevronRight size={14} aria-hidden="true" />
                          )}
                          <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{section.name}</span>
                          <span className="w-32 hidden sm:block">
                            <StackedBar counts={sectionCounts} total={topics.length} />
                          </span>
                          <span className="text-xs text-gray-500 w-14 text-right flex-shrink-0">
                            {sectionStarted}/{topics.length}
                          </span>
                        </button>

                        {sectionOpen && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-gray-400 text-left">
                                  <th className="font-medium pl-12 pr-3 py-1.5">Topic</th>
                                  <th className="font-medium px-3 py-1.5">Status</th>
                                  <th className="font-medium px-3 py-1.5">Chat</th>
                                  <th className="font-medium px-3 py-1.5">Quiz</th>
                                  <th className="font-medium px-3 py-1.5 pr-4">Last activity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {shown.map((topic) => {
                                  const p = progress[topic.id];
                                  const st = STATES.find((s) => s.id === stateOf(p))!;
                                  return (
                                    <tr key={topic.id} className="border-t border-gray-50">
                                      <td className="pl-12 pr-3 py-2 max-w-xs">
                                        <Link
                                          href={`/notes?topicId=${topic.id}`}
                                          title={topic.name}
                                          className="text-gray-800 hover:text-[#1f4e9c] block truncate"
                                        >
                                          {topic.name}
                                        </Link>
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${st.pill}`}>
                                          {st.label}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                                        {p && p.chatCount > 0
                                          ? `${p.chatCount} chat${p.chatCount === 1 ? "" : "s"} · ${p.chatMessages} msgs`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                                        {p && p.quizAttempts > 0
                                          ? `${p.quizAttempts}× · last ${p.lastAccuracy}% · avg ${p.avgAccuracy}%`
                                          : "—"}
                                      </td>
                                      <td className="px-3 py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                                        {p?.lastActivity ? new Date(p.lastActivity).toLocaleDateString() : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
