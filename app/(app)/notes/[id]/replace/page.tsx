"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { planReplacement, type ExistingContent } from "@/lib/notes-import";

interface NoteInfo {
  title: string;
  content: ExistingContent;
}

type Part = "full" | "revision" | "mcq";

export default function ReplaceNotesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [parts, setParts] = useState<Record<Part, boolean>>({ full: false, revision: false, mcq: false });
  const [mcqMode, setMcqMode] = useState<"replace" | "add">("replace");
  const [text, setText] = useState("");
  const [answerKey, setAnswerKey] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetch(`/api/notes/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Note not found" : "Could not load the note");
        const data = await res.json();
        if (!data.content?.markdown) throw new Error("Only notes made with Add notes can be replaced");
        setNote({ title: data.title, content: data.content });
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load the note"));
  }, [params.id]);

  const deferredText = useDeferredValue(text);
  const anyPart = parts.full || parts.revision || parts.mcq;

  // The same logic the server runs, so the preview is exactly what will happen
  const plan = useMemo(() => {
    if (!note || !anyPart || deferredText.trim().length < 10) return null;
    return planReplacement(note.content, deferredText, { ...parts, mcqMode, answerKey });
  }, [note, anyPart, parts, deferredText, mcqMode, answerKey]);

  const toggle = (p: Part) => setParts((prev) => ({ ...prev, [p]: !prev[p] }));

  const save = async () => {
    setConfirm(false);
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/notes/${params.id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...parts, mcqMode, ...(answerKey.trim() ? { answerKey } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || "Could not replace the notes");
        return;
      }
      window.dispatchEvent(new Event("notes:changed"));
      router.push(`/notes/${params.id}`);
    } catch {
      setSaveError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <ErrorState message={loadError} />
      </div>
    );
  }
  if (!note) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const questionCount = note.content.practiceQuestions?.length ?? 0;
  const chosen = [parts.full && "full notes", parts.revision && "quick revision", parts.mcq && (mcqMode === "add" ? "practice questions (adding)" : "practice questions (replacing all)")]
    .filter(Boolean)
    .join(", ");

  const options: Array<{ id: Part; label: string; current: string }> = [
    { id: "full", label: "Full notes", current: "Replaced by your new text" },
    {
      id: "revision",
      label: "Quick revision",
      current: note.content.quickRevisionMarkdown ? "Replaced by the revision section of your text" : "None yet",
    },
    {
      id: "mcq",
      label: "Practice questions",
      current: questionCount ? `${questionCount} questions now` : "None yet",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link
        href={`/notes/${params.id}`}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to the note
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Replace notes</h1>
      <p className="mt-1 text-sm text-gray-500">
        {note.title}. Choose which parts your new text should replace. Everything you don&apos;t tick stays as it is.
      </p>

      <div className="mt-6 space-y-5">
        <fieldset className="rounded-xl border border-gray-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-gray-800">What do you want to replace?</legend>
          <div className="mt-2 space-y-3">
            {options.map((o) => (
              <div key={o.id}>
                <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={parts[o.id]} onChange={() => toggle(o.id)} />
                  <span>
                    <span className="font-medium">{o.label}</span>
                    <span className="block text-xs text-gray-400">{o.current}</span>
                  </span>
                </label>

                {o.id === "mcq" && parts.mcq && (
                  <div className="ml-6 mt-2 space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm" role="radiogroup" aria-label="How to change the practice questions">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="mcq-mode" className="mt-1" checked={mcqMode === "replace"} onChange={() => setMcqMode("replace")} />
                      <span>
                        Replace completely
                        <span className="block text-xs text-gray-400">
                          All {questionCount} current questions are swapped for the ones in your text. A question that is
                          unchanged keeps its answer.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" name="mcq-mode" className="mt-1" checked={mcqMode === "add"} onChange={() => setMcqMode("add")} />
                      <span>
                        Add extra questions
                        <span className="block text-xs text-gray-400">
                          The new questions go after the current ones. Any that are already there are skipped.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="replace-text" className="block text-sm font-medium text-gray-800 mb-1">
            Your new text
          </label>
          <textarea
            id="replace-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            placeholder="Paste the new content. Each ticked part is taken from it: the notes, a section with 'revision' in its heading, and numbered questions with options."
            className="w-full rounded-lg border border-gray-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
          />
        </div>

        {parts.mcq && (
          <div>
            <label htmlFor="replace-key" className="block text-sm font-medium text-gray-800 mb-1">
              Answer key for the new questions (optional)
            </label>
            <input
              id="replace-key"
              value={answerKey}
              onChange={(e) => setAnswerKey(e.target.value)}
              placeholder="1-B, 2-C, 3-A ... (numbered as in your new text)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
            />
          </div>
        )}

        {plan && (
          <div
            className={`rounded-xl border p-4 text-sm ${plan.ok ? "border-[#c5d3ea] bg-[#e3ebf7]" : "border-red-200 bg-red-50"}`}
            aria-live="polite"
          >
            {plan.ok ? (
              <>
                <p className="flex items-center gap-1.5 font-medium text-gray-900">
                  <CheckCircle2 size={16} className="text-[#1f4e9c]" aria-hidden="true" /> This will happen
                </p>
                <ul className="mt-2 list-disc ml-5 space-y-1 text-xs text-gray-700">
                  {plan.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="flex items-start gap-1.5 text-red-800">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" /> {plan.error}
              </p>
            )}
          </div>
        )}

        {saveError && (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={() => setConfirm(true)} loading={saving} disabled={!plan || !plan.ok}>
            Replace
          </Button>
          <Link href={`/notes/${params.id}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Replace these parts?"
        message={`This replaces: ${chosen}. The old version is not kept. Parts you did not tick stay as they are.`}
        confirmLabel="Replace"
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
