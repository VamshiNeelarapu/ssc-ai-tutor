"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, FileText, Plus, TrendingUp, Sparkles, Newspaper } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { RevisionBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";

interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string;
  revisionStatus: "not_started" | "learning" | "needs_revision" | "revised";
  updatedAt: string;
}

interface CAPreviewItem {
  point: string;
  division: "gs" | "static";
}

interface SubjectCard {
  id: string;
  name: string;
  slug: string;
  nodeType: string;
  children: { id: string; name: string }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<SubjectCard[]>([]);
  const [caItems, setCaItems] = useState<CAPreviewItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convRes, notesRes, syllabusRes, caRes] = await Promise.all([
          fetch("/api/conversations"),
          fetch("/api/notes?limit=5"),
          fetch("/api/syllabus"),
          fetch("/api/current-affairs"),
        ]);

        if (caRes.ok) {
          const data = await caRes.json();
          setCaItems(data.digest ? data.digest.items : []);
        }

        if (convRes.ok) {
          const data = await convRes.json();
          setConversations(Array.isArray(data) ? data.slice(0, 5) : []);
        }
        if (notesRes.ok) {
          const data = await notesRes.json();
          setNotes(data.notes || []);
        }
        if (syllabusRes.ok) {
          const data = await syllabusRes.json();
          setSubjects(Array.isArray(data) ? data.filter((n: SubjectCard) => n.nodeType === "subject") : []);
        }
      } catch {
        // Silently fail - show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const subjectColors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-red-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-emerald-500",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(" ")[0] || "Student"}!
        </h1>
        <p className="text-gray-500 mt-1">
          Continue studying or start a new conversation with your AI tutor.
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/chat">
          <Button size="md">
            <Plus size={16} aria-hidden="true" />
            New Chat
          </Button>
        </Link>
        <Link href="/notes">
          <Button variant="secondary" size="md">
            <FileText size={16} aria-hidden="true" />
            Browse Notes
          </Button>
        </Link>
      </div>

      {/* Today's current affairs */}
      <section aria-labelledby="ca-heading" className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 id="ca-heading" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Newspaper size={18} className="text-[#1f4e9c]" aria-hidden="true" />
            Today&apos;s Current Affairs
          </h2>
          <Link href="/current-affairs" className="text-sm text-blue-600 hover:text-blue-500">
            {caItems && caItems.length > 0 ? "See all" : "Open"}
          </Link>
        </div>
        {caItems && caItems.length > 0 ? (
          <ul className="space-y-2">
            {caItems.slice(0, 4).map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-[#1f4e9c] flex-shrink-0" aria-hidden="true">•</span>
                <span className="line-clamp-2">{item.point}</span>
              </li>
            ))}
            {caItems.length > 4 && (
              <li className="text-xs text-gray-400 pl-4">+ {caItems.length - 4} more points today</li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Get today&apos;s news as a point-wise list, split into GS topics and Static GK.{" "}
            <Link href="/current-affairs" className="text-blue-600 hover:text-blue-500">
              Get today&apos;s current affairs
            </Link>
          </p>
        )}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<MessageSquare className="text-blue-600" size={20} />}
          label="Conversations"
          value={conversations.length}
          color="blue"
        />
        <StatCard
          icon={<FileText className="text-purple-600" size={20} />}
          label="Notes Saved"
          value={notes.length}
          color="purple"
        />
        <StatCard
          icon={<TrendingUp className="text-green-600" size={20} />}
          label="Topics Revised"
          value={notes.filter((n) => n.revisionStatus === "revised").length}
          color="green"
        />
        <StatCard
          icon={<TrendingUp className="text-amber-600" size={20} />}
          label="Need Revision"
          value={notes.filter((n) => n.revisionStatus === "needs_revision").length}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <section aria-labelledby="conversations-heading">
          <div className="flex items-center justify-between mb-4">
            <h2
              id="conversations-heading"
              className="text-lg font-semibold text-gray-900"
            >
              Recent Conversations
            </h2>
            <Link
              href="/chat"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              New chat
            </Link>
          </div>

          {conversations.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <MessageSquare className="mx-auto text-gray-300 mb-3" size={32} />
              <p className="text-sm text-gray-500">No conversations yet.</p>
              <Link href="/chat" className="mt-3 inline-block">
                <Button size="sm">Start chatting</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <MessageSquare
                    size={16}
                    className="text-blue-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {conv.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {conv.messageCount} messages ·{" "}
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recent Notes */}
        <section aria-labelledby="notes-heading">
          <div className="flex items-center justify-between mb-4">
            <h2
              id="notes-heading"
              className="text-lg font-semibold text-gray-900"
            >
              Recent Notes
            </h2>
            <Link
              href="/notes"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              View all
            </Link>
          </div>

          {notes.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <FileText className="mx-auto text-gray-300 mb-3" size={32} />
              <p className="text-sm text-gray-500">No notes saved yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Chat with the AI and generate study notes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <FileText
                    size={16}
                    className="text-purple-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {note.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <RevisionBadge status={note.revisionStatus} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* General chat entry */}
      <section className="mt-8 mb-8">
        <GeneralChatCard />
      </section>

      {/* Subjects grid */}
      {subjects.length > 0 && (
        <section aria-labelledby="subjects-heading">
          <h2
            id="subjects-heading"
            className="text-lg font-semibold text-gray-900 mb-4"
          >
            SSC CGL Syllabus Subjects
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {subjects.map((subject, i) => {
              const chatHint = encodeURIComponent(
                `I want to study ${subject.name} for SSC CGL. Which topics matter most, what is the best order to study them, and how should I practise for speed and accuracy in Tier-I and Tier-II?`
              );
              const chatSubject = encodeURIComponent(subject.name);
              return (
                <div
                  key={subject.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col gap-3"
                >
                  <Link href={`/notes?subjectId=${subject.id}`} className="group flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg ${subjectColors[i % subjectColors.length]} flex items-center justify-center mb-3`}
                      aria-hidden="true"
                    >
                      <span className="text-white text-lg font-bold">
                        {subject.name.charAt(0)}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {subject.name}
                    </h3>
                    {subject.children.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {subject.children.length} sections
                      </p>
                    )}
                  </Link>
                  <Link
                    href={`/chat?hint=${chatHint}&subject=${chatSubject}`}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-100 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <Sparkles size={11} aria-hidden="true" />
                    Ask AI
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function GeneralChatCard() {
  const router = useRouter();
  const [input, setInput] = useState("");

  const start = () => {
    const q = input.trim();
    if (q) {
      router.push(`/chat?hint=${encodeURIComponent(q)}`);
    } else {
      router.push("/chat");
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={18} className="text-blue-400" />
        <h2 className="text-base font-semibold">General Chat</h2>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Ask anything — not tied to any subject. Use it like ChatGPT.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="Ask anything…"
          className="flex-1 bg-slate-700 text-white placeholder-slate-400 border border-slate-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={start}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          Chat →
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg bg-${color}-50`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
