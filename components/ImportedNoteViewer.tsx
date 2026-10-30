"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, ChevronDown, Copy, Download, Eye, KeyRound, RotateCcw, Sparkles, Wand2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarkdownBody } from "@/components/MarkdownBody";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import { getStoredModel } from "@/lib/models";
import { copyText } from "@/lib/clipboard";
import type { NoteDetail } from "@/hooks/useNotes";

type Content = NoteDetail["content"];
type Question = NonNullable<Content["practiceQuestions"]>[number];
type Tab = "full" | "revision" | "practice";

export function ImportedNoteViewer({ note }: { note: NoteDetail }) {
  const { showError } = useErrorPopup();
  const [content, setContent] = useState<Content>(note.content);
  const [tab, setTab] = useState<Tab>("full");
  const questions = content.practiceQuestions ?? [];

  // Calls the follow-up endpoint; returns the JSON or null after showing the error
  const act = async (body: Record<string, unknown>, failure: string) => {
    const model = getStoredModel();
    try {
      const res = await fetch(`/api/notes/${note.id}/imported`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
      });
      if (!res.ok) {
        showError(await readApiError(res, failure, model));
        return null;
      }
      return await res.json();
    } catch (err) {
      showError(toAppError(err, failure, model));
      return null;
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "full", label: "Full Notes" },
    { id: "revision", label: "Quick Revision" },
    { id: "practice", label: `Practice Questions${questions.length ? ` (${questions.length})` : ""}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex">
        <div className="inline-flex flex-wrap bg-gray-100 rounded-full p-1 gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
                tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "full" && <MarkdownBody markdown={content.markdown ?? ""} />}

      {tab === "revision" && (
        <RevisionTab
          markdown={content.quickRevisionMarkdown}
          onGenerate={async () => {
            const data = await act({ action: "quick-revision-generate" }, "Could not make the quick revision");
            if (data) setContent((c) => ({ ...c, quickRevisionMarkdown: data.quickRevisionMarkdown }));
            return Boolean(data);
          }}
          onSave={async (text) => {
            const data = await act({ action: "quick-revision-save", text }, "Could not save the quick revision");
            if (data) setContent((c) => ({ ...c, quickRevisionMarkdown: data.quickRevisionMarkdown }));
            return Boolean(data);
          }}
        />
      )}

      {tab === "practice" && (
        <PracticeTab
          noteId={note.id}
          questions={questions}
          intro={content.practiceNote}
          onAnswerKey={async (key) => {
            const data = await act({ action: "answer-key", key }, "Could not apply the answer key");
            if (data) setContent((c) => ({ ...c, practiceQuestions: data.practiceQuestions }));
            return Boolean(data);
          }}
          onAI={async () => {
            const data = await act({ action: "answers-ai" }, "Could not work out the answers");
            if (data) setContent((c) => ({ ...c, practiceQuestions: data.practiceQuestions }));
            return Boolean(data);
          }}
        />
      )}
    </div>
  );
}

// ── Quick Revision ──────────────────────────────────────────────────────────

function RevisionTab({
  markdown,
  onGenerate,
  onSave,
}: {
  markdown?: string;
  onGenerate: () => Promise<boolean>;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState<"generate" | null>(null);

  const generate = async () => {
    setConfirm(null);
    setBusy("generate");
    await onGenerate();
    setBusy(null);
  };
  const save = async () => {
    setBusy("save");
    const ok = await onSave(text);
    setBusy(null);
    if (ok) {
      setPasting(false);
      setText("");
    }
  };

  const pasteBox = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <label htmlFor="own-revision" className="block text-sm font-medium text-gray-800">
        Paste your own quick revision content
      </label>
      <textarea
        id="own-revision"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Paste the points you want here. It is only tidied up, not rewritten."
        className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={busy === "save"} disabled={!text.trim()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPasting(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );

  if (!markdown) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">No quick revision yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Make it from your full notes (it keeps every fact, only shorter), or paste your own.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={generate} loading={busy === "generate"}>
              <Sparkles size={14} aria-hidden="true" /> Generate from full notes
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPasting(true)} disabled={busy !== null}>
              Paste my own
            </Button>
          </div>
          {busy === "generate" && <p className="mt-2 text-xs text-gray-400">This can take a minute.</p>}
        </div>
        {pasting && pasteBox}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setConfirm("generate")} loading={busy === "generate"}>
          <RotateCcw size={14} aria-hidden="true" /> Regenerate from full notes
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setPasting(true)} disabled={busy !== null}>
          Replace with my own
        </Button>
      </div>
      {pasting && pasteBox}
      <MarkdownBody markdown={markdown} />
      <ConfirmDialog
        open={confirm === "generate"}
        title="Replace the quick revision?"
        message="The current quick revision will be replaced with one made from your full notes."
        confirmLabel="Replace"
        onConfirm={generate}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// ── Practice Questions ──────────────────────────────────────────────────────

export function PracticeTab({
  noteId,
  questions,
  intro,
  onAnswerKey,
  onAI,
}: {
  noteId: string;
  questions: Question[];
  intro?: string;
  onAnswerKey: (key: string) => Promise<boolean>;
  onAI: () => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  // Questions that have been checked (their result is shown and they are locked)
  const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set());
  // Unattempted questions whose answer was shown with "Show answer"
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<"ai" | "key" | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyText, setKeyText] = useState("");
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
        No practice questions were found in this note.
      </div>
    );
  }

  const withAnswer = questions.filter((q) => q.correctOptionIndex !== undefined).length;
  const missing = questions.length - withAnswer;
  const answered = Object.keys(picked).length;
  const answeredNotChecked = Object.keys(picked)
    .map(Number)
    .filter((i) => !checkedSet.has(i));
  const notChecked = questions.length - checkedSet.size;
  const anyChecked = checkedSet.size > 0;

  let correct = 0;
  let wrong = 0;
  checkedSet.forEach((i) => {
    const q = questions[i];
    if (picked[i] === undefined || q?.correctOptionIndex === undefined) return;
    if (picked[i] === q.correctOptionIndex) correct++;
    else wrong++;
  });
  const notAttempted = questions.filter((_, i) => picked[i] === undefined).length;

  const checkAnswered = () => {
    setCheckedSet((prev) => new Set([...Array.from(prev), ...answeredNotChecked]));
    setMenuOpen(false);
  };
  const checkAll = () => {
    setCheckedSet(new Set(questions.map((_, i) => i)));
    setMenuOpen(false);
  };
  const reveal = (i: number) => setRevealed((prev) => new Set(prev).add(i));
  const reset = () => {
    setPicked({});
    setCheckedSet(new Set());
    setRevealed(new Set());
  };

  const copyAll = async () => {
    // Questions first, then a Solutions section with the correct option for each number
    const body = questions
      .map((q, i) => [`${i + 1}. ${q.question}`, ...q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`)].join("\n"))
      .join("\n\n");
    const solutions = questions
      .map((q, i) => `${i + 1}. ${q.correctOptionIndex !== undefined ? String.fromCharCode(65 + q.correctOptionIndex) : "-"}`)
      .join("\n");
    const text = `${body}\n\nSolutions\n${solutions}\n`;
    setCopied(await copyText(text));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {intro && <p className="text-sm text-gray-500">{intro}</p>}

      {missing > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {missing === questions.length ? "These questions have no answers yet." : `${missing} of ${questions.length} questions have no answer yet.`}
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Paste an answer key, or let the AI work them out from your notes. AI answers are marked so you can check them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={async () => {
                setBusy("ai");
                await onAI();
                setBusy(null);
              }}
              loading={busy === "ai"}
              disabled={busy === "key"}
            >
              <Wand2 size={14} aria-hidden="true" /> Work out answers with AI
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setKeyOpen((v) => !v)} disabled={busy !== null}>
              <KeyRound size={14} aria-hidden="true" /> Paste answer key
            </Button>
          </div>
          {keyOpen && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <textarea
                value={keyText}
                onChange={(e) => setKeyText(e.target.value)}
                rows={3}
                placeholder="1-B, 2-C, 3-A ..."
                aria-label="Answer key"
                className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
              />
              <Button
                size="sm"
                loading={busy === "key"}
                disabled={!keyText.trim() || busy === "ai"}
                onClick={async () => {
                  setBusy("key");
                  const ok = await onAnswerKey(keyText);
                  setBusy(null);
                  if (ok) {
                    setKeyOpen(false);
                    setKeyText("");
                  }
                }}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" ref={menuRef}>
          <Button
            size="sm"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={withAnswer === 0 || notChecked === 0}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Check size={14} aria-hidden="true" /> Check answers
            <ChevronDown size={12} aria-hidden="true" />
          </Button>
          {menuOpen && (
            <div role="menu" className="absolute left-0 z-10 mt-1 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                role="menuitem"
                onClick={checkAnswered}
                disabled={answeredNotChecked.length === 0}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-white"
              >
                <span className="font-medium">Check answered</span>
                <span className="block text-xs text-gray-400">
                  {answeredNotChecked.length === 0
                    ? "Answer a question first"
                    : `The ${answeredNotChecked.length} you answered. The rest get a "Show answer" button.`}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={checkAll}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="font-medium">Check all</span>
                <span className="block text-xs text-gray-400">All {questions.length} questions, answers shown for every one.</span>
              </button>
            </div>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={reset} disabled={answered === 0 && !anyChecked && revealed.size === 0}>
          <X size={14} aria-hidden="true" /> Clear
        </Button>
        <Button size="sm" variant="secondary" onClick={() => window.open(`/notes/${noteId}/print?mode=practice`, "_blank")}>
          <Download size={14} aria-hidden="true" /> Download PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={copyAll}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy questions"}
        </Button>
        <span className="text-xs text-gray-400">
          {answered} of {questions.length} answered
        </span>
      </div>

      {anyChecked && (
        <div className="rounded-xl border border-[#1f4e9c] bg-[#e3ebf7] p-4 text-sm text-gray-900" aria-live="polite">
          <p className="font-medium">
            Score: {correct} correct, {wrong} wrong
          </p>
          <p className="mt-0.5 text-xs text-gray-600">
            {notAttempted} not attempted
            {missing > 0 ? ` · ${missing} question${missing === 1 ? " has" : "s have"} no answer to check against` : ""}
          </p>
        </div>
      )}

      <ol className="space-y-4">
        {questions.map((q, i) => {
          const hasAnswer = q.correctOptionIndex !== undefined;
          const isChecked = checkedSet.has(i);
          const isRevealed = revealed.has(i);
          const show = isChecked || isRevealed;
          const unattempted = picked[i] === undefined;
          return (
            <li key={i} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-900">
                <span className="text-gray-400 mr-1">{i + 1}.</span>
                {q.question}
              </p>
              <div className="mt-3 space-y-1.5" role="radiogroup" aria-label={`Question ${i + 1}`}>
                {q.options.map((o, j) => {
                  const isPicked = picked[i] === j;
                  const isRight = show && hasAnswer && j === q.correctOptionIndex;
                  const isWrong = isChecked && isPicked && hasAnswer && j !== q.correctOptionIndex;
                  return (
                    <button
                      key={j}
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      disabled={show}
                      onClick={() => setPicked((p) => ({ ...p, [i]: j }))}
                      className={clsx(
                        "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        isRight && "border-green-500 bg-green-50 text-green-900",
                        isWrong && "border-red-400 bg-red-50 text-red-900",
                        !isRight && !isWrong && isPicked && "border-[#1f4e9c] bg-[#e3ebf7]",
                        !isRight && !isWrong && !isPicked && "border-gray-200 hover:border-[#93a3c2]"
                      )}
                    >
                      <span className="font-medium text-gray-500">{String.fromCharCode(65 + j)}.</span>
                      <span>{o}</span>
                    </button>
                  );
                })}
              </div>

              {/* After "Check answered": every question you have not attempted can show its answer */}
              {anyChecked && !show && unattempted && (
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={() => reveal(i)}>
                    <Eye size={14} aria-hidden="true" /> Show answer
                  </Button>
                </div>
              )}

              {show && hasAnswer && (
                <div className="mt-3 text-xs text-gray-600">
                  <p>
                    <span className="font-semibold">Answer: {String.fromCharCode(65 + (q.correctOptionIndex as number))}</span>
                    {unattempted && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Not attempted</span>}
                    {q.answerSource === "ai" && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">AI-generated, please check</span>
                    )}
                  </p>
                  {q.explanation && <p className="mt-1">{q.explanation}</p>}
                </div>
              )}
              {show && !hasAnswer && <p className="mt-3 text-xs text-gray-400">No answer available for this question yet.</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ImportedNoteViewer;
