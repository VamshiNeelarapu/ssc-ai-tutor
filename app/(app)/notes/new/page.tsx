"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { parseNotesDocument } from "@/lib/notes-import";

interface TreeNode {
  id: string;
  name: string;
  nodeType: string;
  children?: TreeNode[];
}

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c] disabled:bg-gray-50 disabled:text-gray-400";

function AddNotes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTopicId = searchParams.get("topicId") || "";

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [ownRevision, setOwnRevision] = useState("");
  const [answerKey, setAnswerKey] = useState("");
  const [moveRevision, setMoveRevision] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/syllabus")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setTree(data))
      .catch(() => {});
  }, []);

  // Open straight on a topic when we came from its notes page
  useEffect(() => {
    if (!presetTopicId || tree.length === 0) return;
    for (const subject of tree) {
      for (const section of subject.children ?? []) {
        if ((section.children ?? []).some((t) => t.id === presetTopicId)) {
          setSubjectId(subject.id);
          setSectionId(section.id);
          setTopicId(presetTopicId);
          return;
        }
      }
    }
  }, [presetTopicId, tree]);

  const sections = tree.find((s) => s.id === subjectId)?.children ?? [];
  const topics = sections.find((s) => s.id === sectionId)?.children?.filter((t) => t.nodeType === "topic") ?? [];

  const deferredNotes = useDeferredValue(notes);
  const preview = useMemo(
    () =>
      deferredNotes.trim().length >= 30
        ? parseNotesDocument(deferredNotes, { extractRevision: moveRevision && !ownRevision.trim() })
        : null,
    [deferredNotes, moveRevision, ownRevision]
  );
  const hasRevisionHeading = useMemo(
    () => (deferredNotes.trim().length >= 30 ? parseNotesDocument(deferredNotes).revision?.heading ?? null : null),
    [deferredNotes]
  );

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/notes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(topicId ? { topicId } : {}),
          ...(ownRevision.trim() ? { quickRevision: ownRevision } : {}),
          ...(answerKey.trim() ? { answerKey } : {}),
          moveRevision,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the notes");
        return;
      }
      window.dispatchEvent(new Event("notes:changed"));
      router.push(`/notes/${data.id}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const withAnswers = preview?.questions.filter((q) => q.answerIndex !== undefined).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link
        href={topicId ? `/notes?topicId=${topicId}` : "/notes"}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to notes
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Add notes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Paste your notes as they are. Nothing is rewritten: they are only tidied into a readable page. Practice
        questions go to their own tab.
      </p>

      <div className="mt-6 space-y-5">
        <fieldset className="rounded-xl border border-gray-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-gray-800">Where do these notes belong? (optional)</legend>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setSectionId("");
                setTopicId("");
              }}
              className={selectClass}
              aria-label="Subject"
            >
              <option value="">Subject</option>
              {tree.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setTopicId("");
              }}
              disabled={!subjectId}
              className={selectClass}
              aria-label="Chapter"
            >
              <option value="">Chapter</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!sectionId}
              className={selectClass}
              aria-label="Topic"
            >
              <option value="">Topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Picking a topic counts these notes toward its chapter, and lets flashcards and chapter notes use them.
          </p>
        </fieldset>

        <div>
          <label htmlFor="note-title" className="block text-sm font-medium text-gray-800 mb-1">
            Title
          </label>
          <input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={preview?.title || "Taken from the first heading of your notes"}
            maxLength={300}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
          />
        </div>

        <div>
          <label htmlFor="note-body" className="block text-sm font-medium text-gray-800 mb-1">
            Your notes
          </label>
          <textarea
            id="note-body"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={16}
            placeholder="Paste the full content here, including practice questions."
            className="w-full rounded-lg border border-gray-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
          />
        </div>

        {preview && (
          <div className="rounded-xl border border-[#c5d3ea] bg-[#e3ebf7] p-4 text-sm text-gray-800" aria-live="polite">
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={16} className="text-[#1f4e9c]" aria-hidden="true" /> What I found
            </p>
            <ul className="mt-2 space-y-1 text-xs text-gray-700">
              <li>
                {preview.stats.headings} headings
                {preview.stats.tables > 0 ? `, ${preview.stats.tables} table${preview.stats.tables === 1 ? "" : "s"}` : ""}
                {preview.stats.imagesRemoved > 0
                  ? `, ${preview.stats.imagesRemoved} image link${preview.stats.imagesRemoved === 1 ? "" : "s"} removed`
                  : ""}
              </li>
              <li>
                {preview.questions.length > 0
                  ? `${preview.questions.length} practice questions go to the Practice tab (${withAnswers} come with answers${
                      withAnswers < preview.questions.length ? "; for the rest you can paste a key or let the AI work them out" : ""
                    })`
                  : "No practice questions found"}
              </li>
              <li>
                {ownRevision.trim()
                  ? "Your own quick revision content will be used"
                  : preview.revision
                  ? `The section "${preview.revision.heading}" goes to the Quick Revision tab`
                  : "No revision section found: you can generate the Quick Revision from the full notes afterwards"}
              </li>
            </ul>
            {hasRevisionHeading && !ownRevision.trim() && (
              <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={moveRevision} onChange={(e) => setMoveRevision(e.target.checked)} />
                Move "{hasRevisionHeading}" to Quick Revision (otherwise it stays in the full notes)
              </label>
            )}
          </div>
        )}

        <details className="rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-800">
            Quick revision content and answer key (optional)
          </summary>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="own-revision-new" className="block text-xs font-medium text-gray-700 mb-1">
                Your own quick revision content
              </label>
              <textarea
                id="own-revision-new"
                value={ownRevision}
                onChange={(e) => setOwnRevision(e.target.value)}
                rows={6}
                placeholder="Leave empty to use a revision section from your notes, or generate one later."
                className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
              />
            </div>
            <div>
              <label htmlFor="answer-key-new" className="block text-xs font-medium text-gray-700 mb-1">
                Answer key for the practice questions
              </label>
              <input
                id="answer-key-new"
                value={answerKey}
                onChange={(e) => setAnswerKey(e.target.value)}
                placeholder="1-B, 2-C, 3-A ..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
              />
            </div>
          </div>
        </details>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={save} loading={saving} disabled={notes.trim().length < 30}>
            Save notes
          </Button>
          <Link href="/notes">
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AddNotesPage() {
  return (
    <Suspense fallback={null}>
      <AddNotes />
    </Suspense>
  );
}
