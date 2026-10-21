"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { NoteDetail } from "@/hooks/useNotes";

export default function EditNotePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [revisionStatus, setRevisionStatus] = useState("not_started");
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [syllabus, setSyllabus] = useState<
    Array<{ id: string; name: string; children: Array<{ id: string; name: string; children?: Array<{ id: string; name: string }> }> }>
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [noteRes, syllabusRes] = await Promise.all([
          fetch(`/api/notes/${params.id}`),
          fetch("/api/syllabus"),
        ]);

        if (!noteRes.ok) {
          router.push("/notes");
          return;
        }

        const noteData: NoteDetail = await noteRes.json();
        setNote(noteData);
        setTitle(noteData.title);
        setOverview(noteData.content.overview || "");
        setRevisionStatus(noteData.revisionStatus);
        setSubjectId(noteData.subjectId || "");
        setSectionId(noteData.sectionId || "");
        setTopicId((noteData as NoteDetail & { topicId?: string }).topicId || "");

        if (syllabusRes.ok) {
          const syllabusData = await syllabusRes.json();
          if (Array.isArray(syllabusData)) setSyllabus(syllabusData);
        }
      } catch {
        router.push("/notes");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, router]);

  const sections = syllabus.find((s) => s.id === subjectId)?.children || [];
  const topics = sections.find((s) => s.id === sectionId)?.children || [];

  const handleSave = async () => {
    if (!note) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/notes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: {
            ...note.content,
            overview,
          },
          revisionStatus,
          subjectId: subjectId || undefined,
          sectionId: sectionId || undefined,
          topicId: topicId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      router.push(`/notes/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Back */}
      <Link
        href={`/notes/${params.id}`}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to note
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Note</h1>
        <div className="flex gap-2">
          <Link href={`/notes/${params.id}`}>
            <Button variant="secondary" size="md">Cancel</Button>
          </Link>
          <Button size="md" onClick={handleSave} loading={saving}>
            <Save size={14} aria-hidden="true" />
            Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Overview
          </label>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder="Topic overview..."
            aria-label="Note overview"
          />
        </div>

        {/* Subject */}
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
              <option value="">No subject selected</option>
              {syllabus.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Section */}
        {sections.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Section</label>
            <div className="relative">
              <select
                value={sectionId}
                onChange={(e) => { setSectionId(e.target.value); setTopicId(""); }}
                className="w-full h-10 appearance-none border border-gray-300 rounded-md px-3 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select section"
              >
                <option value="">No section selected</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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

        {/* Topic */}
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
                <option value="">No topic selected</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
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

        {/* Revision status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Revision Status
          </label>
          <div className="relative">
            <select
              value={revisionStatus}
              onChange={(e) => setRevisionStatus(e.target.value)}
              className="w-full h-10 appearance-none border border-gray-300 rounded-md px-3 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select revision status"
            >
              <option value="not_started">Not Started</option>
              <option value="learning">Learning</option>
              <option value="needs_revision">Needs Revision</option>
              <option value="revised">Revised</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
