"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCopy, Lock, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import { getStoredModel } from "@/lib/models";

interface ChapterStatus {
  sectionName: string;
  topics: Array<{ id: string; name: string; noteCount: number }>;
  totalTopics: number;
  coveredTopics: number;
  ready: boolean;
  existingNoteId: string | null;
}

export function ChapterNotesCard({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const { showError } = useErrorPopup();
  const [status, setStatus] = useState<ChapterStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/chapter-summary?sectionId=${sectionId}`);
      if (res.ok) setStatus(await res.json());
    } catch {
      /* the card simply stays hidden */
    }
  }, [sectionId]);

  useEffect(() => {
    setStatus(null);
    load();
  }, [load]);

  const generate = async () => {
    setConfirmRegenerate(false);
    setGenerating(true);
    const model = getStoredModel();
    try {
      const res = await fetch("/api/notes/chapter-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, model }),
      });
      if (!res.ok) {
        showError(await readApiError(res, "Could not make the chapter notes", model));
        return;
      }
      const data = await res.json();
      router.push(`/notes/${data.id}`);
    } catch (err) {
      showError(toAppError(err, "Could not make the chapter notes", model));
    } finally {
      setGenerating(false);
      load();
    }
  };

  if (!status || status.totalTopics === 0) return null;

  const missing = status.topics.filter((t) => t.noteCount === 0);
  const percent = Math.round((status.coveredTopics / status.totalTopics) * 100);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#e3ebf7]">
          {status.ready ? (
            <BookCopy size={18} className="text-[#1f4e9c]" aria-hidden="true" />
          ) : (
            <Lock size={16} className="text-gray-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">Chapter notes</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {status.ready
              ? "Every topic has a note. Combine them into one revision note for this chapter. It only uses what is already in your topic notes."
              : `Unlocks when every topic has a note. ${status.coveredTopics} of ${status.totalTopics} topics done (${percent}%).`}
          </p>

          {!status.ready && (
            <>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full bg-[#1f4e9c]" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Still needed: {missing.slice(0, 4).map((t) => t.name).join(", ")}
                {missing.length > 4 ? ` and ${missing.length - 4} more` : ""}
              </p>
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status.existingNoteId && (
              <Link href={`/notes/${status.existingNoteId}`}>
                <Button size="sm" variant="secondary">
                  Open chapter notes
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              disabled={!status.ready || generating}
              loading={generating}
              onClick={() => (status.existingNoteId ? setConfirmRegenerate(true) : generate())}
              title={status.ready ? undefined : "Make notes for every topic first"}
            >
              <Sparkles size={14} aria-hidden="true" />
              {generating
                ? "Making notes..."
                : status.existingNoteId
                ? "Regenerate chapter notes"
                : "Make chapter notes"}
            </Button>
            {generating && <span className="text-xs text-gray-400">This can take a minute.</span>}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Regenerate chapter notes?"
        message="The existing chapter notes will be replaced, including any edits you made to them."
        confirmLabel="Regenerate"
        onConfirm={generate}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  );
}

export default ChapterNotesCard;
